from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from secrets import token_urlsafe

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models.run import RunCallbackTicket


def _utcnow() -> datetime:
    return datetime.now(UTC)


def _normalize_datetime(value: datetime | None) -> datetime | None:
    if value is None:
        return None
    if value.tzinfo is None:
        return value.replace(tzinfo=UTC)
    return value.astimezone(UTC)


@dataclass(frozen=True)
class CallbackTicketSnapshot:
    ticket: str
    run_id: str
    node_run_id: str
    tool_call_id: str | None
    tool_id: str | None
    tool_call_index: int
    waiting_status: str
    reason: str | None
    status: str
    created_at: datetime
    expires_at: datetime | None
    expired_at: datetime | None

    def as_checkpoint_payload(self) -> dict[str, object]:
        payload: dict[str, object] = {
            "ticket": self.ticket,
            "run_id": self.run_id,
            "node_run_id": self.node_run_id,
            "tool_call_id": self.tool_call_id,
            "tool_id": self.tool_id,
            "tool_call_index": self.tool_call_index,
            "waiting_status": self.waiting_status,
            "reason": self.reason,
            "status": self.status,
            "created_at": self.created_at.isoformat().replace("+00:00", "Z"),
        }
        if self.expires_at is not None:
            payload["expires_at"] = self.expires_at.isoformat().replace("+00:00", "Z")
        if self.expired_at is not None:
            payload["expired_at"] = self.expired_at.isoformat().replace("+00:00", "Z")
        return payload


class RunCallbackTicketService:
    def __init__(self, *, ticket_ttl_seconds: int | None = None) -> None:
        resolved_ttl = (
            get_settings().callback_ticket_ttl_seconds
            if ticket_ttl_seconds is None
            else ticket_ttl_seconds
        )
        self._ticket_ttl_seconds = max(int(resolved_ttl), 0)

    def issue_ticket(
        self,
        db: Session,
        *,
        run_id: str,
        node_run_id: str,
        tool_call_id: str | None,
        tool_id: str | None,
        tool_call_index: int,
        waiting_status: str,
        reason: str | None,
    ) -> CallbackTicketSnapshot:
        self.cancel_pending_for_node_run(
            db,
            node_run_id=node_run_id,
            reason="superseded_by_new_waiting_callback",
        )
        created_at = _utcnow()
        record = RunCallbackTicket(
            id=token_urlsafe(24),
            run_id=run_id,
            node_run_id=node_run_id,
            tool_call_id=tool_call_id,
            tool_id=tool_id,
            tool_call_index=max(int(tool_call_index), 0),
            waiting_status=waiting_status,
            status="pending",
            reason=reason,
            callback_payload=None,
            created_at=created_at,
            expires_at=created_at + timedelta(seconds=self._ticket_ttl_seconds),
        )
        db.add(record)
        db.flush()
        return self._snapshot(record)

    def get_ticket(self, db: Session, ticket: str) -> RunCallbackTicket | None:
        return db.get(RunCallbackTicket, ticket)

    def snapshot(self, record: RunCallbackTicket) -> CallbackTicketSnapshot:
        return self._snapshot(record)

    def list_expired_pending_tickets(
        self,
        db: Session,
        *,
        now: datetime | None = None,
        limit: int | None = None,
    ) -> list[RunCallbackTicket]:
        effective_now = _normalize_datetime(now or _utcnow())
        statement = (
            select(RunCallbackTicket)
            .where(
                RunCallbackTicket.status == "pending",
                RunCallbackTicket.expires_at.is_not(None),
                RunCallbackTicket.expires_at <= effective_now,
            )
            .order_by(
                RunCallbackTicket.expires_at.asc(),
                RunCallbackTicket.created_at.asc(),
            )
        )
        if limit is not None:
            statement = statement.limit(max(int(limit), 1))
        return db.scalars(statement).all()

    def consume_ticket(
        self,
        record: RunCallbackTicket,
        *,
        callback_payload: dict,
    ) -> CallbackTicketSnapshot:
        record.status = "consumed"
        record.callback_payload = callback_payload
        record.consumed_at = _utcnow()
        return self._snapshot(record)

    def is_ticket_expired(
        self,
        record: RunCallbackTicket,
        *,
        now: datetime | None = None,
    ) -> bool:
        if record.status != "pending" or record.expires_at is None:
            return False
        effective_now = _normalize_datetime(now or _utcnow())
        expires_at = _normalize_datetime(record.expires_at)
        if effective_now is None or expires_at is None:
            return False
        return expires_at <= effective_now

    def expire_ticket(
        self,
        record: RunCallbackTicket,
        *,
        reason: str,
        expired_at: datetime | None = None,
        callback_payload: dict | None = None,
    ) -> CallbackTicketSnapshot:
        timestamp = expired_at or _utcnow()
        record.status = "expired"
        record.callback_payload = callback_payload or {"reason": reason}
        record.expired_at = timestamp
        return self._snapshot(record)

    def cancel_pending_for_node_run(
        self,
        db: Session,
        *,
        node_run_id: str,
        reason: str,
    ) -> list[RunCallbackTicket]:
        records = db.scalars(
            select(RunCallbackTicket).where(
                RunCallbackTicket.node_run_id == node_run_id,
                RunCallbackTicket.status == "pending",
            )
        ).all()
        for record in records:
            record.status = "canceled"
            record.callback_payload = {"reason": reason}
            record.canceled_at = _utcnow()
        return records

    def _snapshot(self, record: RunCallbackTicket) -> CallbackTicketSnapshot:
        return CallbackTicketSnapshot(
            ticket=record.id,
            run_id=record.run_id,
            node_run_id=record.node_run_id,
            tool_call_id=record.tool_call_id,
            tool_id=record.tool_id,
            tool_call_index=record.tool_call_index,
            waiting_status=record.waiting_status,
            reason=record.reason,
            status=record.status,
            created_at=record.created_at,
            expires_at=record.expires_at,
            expired_at=record.expired_at,
        )
