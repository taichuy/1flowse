from __future__ import annotations

from datetime import UTC, datetime, timedelta
from uuid import uuid4

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import Settings, get_settings
from app.models.sensitive_access import (
    ApprovalTicketRecord,
    NotificationDispatchRecord,
    SensitiveAccessRequestRecord,
    SensitiveResourceRecord,
)
from app.services.notification_channel_governance import (
    evaluate_notification_dispatch_preflight,
)
from app.services.notification_dispatch_scheduler import (
    NotificationDispatchScheduler,
    get_notification_dispatch_scheduler,
)
from app.services.run_resume_scheduler import (
    RunResumeScheduler,
    get_run_resume_scheduler,
)
from app.services.sensitive_access_policy import (
    evaluate_default_sensitive_access_policy,
)
from app.services.sensitive_access_queries import (
    find_credential_resource,
    find_existing_access_bundle,
    find_tool_resource,
    find_workflow_context_resource,
    list_access_requests,
    list_approval_tickets,
    list_notification_dispatches,
    list_resources,
    validate_runtime_scope,
)
from app.services.sensitive_access_types import (
    AccessDecisionResult,
    ApprovalDecisionBundle,
    ApprovalTicketExpiryItem,
    ApprovalTicketExpiryResult,
    NotificationDispatchRetryBundle,
    SensitiveAccessControlError,
    SensitiveAccessRequestBundle,
    SensitiveAccessTicketExpiredError,
)


def _utcnow() -> datetime:
    return datetime.now(UTC)


def _normalize_datetime(value: datetime | None) -> datetime | None:
    if value is None:
        return None
    if value.tzinfo is None:
        return value.replace(tzinfo=UTC)
    return value.astimezone(UTC)


__all__ = [
    "AccessDecisionResult",
    "ApprovalTicketExpiryResult",
    "ApprovalDecisionBundle",
    "NotificationDispatchRetryBundle",
    "SensitiveAccessControlError",
    "SensitiveAccessControlService",
    "SensitiveAccessRequestBundle",
    "SensitiveAccessTicketExpiredError",
]


class SensitiveAccessControlService:
    def __init__(
        self,
        *,
        resume_scheduler: RunResumeScheduler | None = None,
        notification_dispatch_scheduler: NotificationDispatchScheduler | None = None,
        settings: Settings | None = None,
    ) -> None:
        self._resume_scheduler = resume_scheduler or get_run_resume_scheduler()
        self._notification_dispatch_scheduler = (
            notification_dispatch_scheduler or get_notification_dispatch_scheduler()
        )
        self._settings = settings or get_settings()

    def create_resource(
        self,
        db: Session,
        *,
        label: str,
        sensitivity_level: str,
        source: str,
        description: str | None = None,
        metadata: dict | None = None,
    ) -> SensitiveResourceRecord:
        record = SensitiveResourceRecord(
            id=str(uuid4()),
            label=label.strip(),
            description=(description or None),
            sensitivity_level=sensitivity_level,
            source=source,
            metadata_payload=dict(metadata or {}),
            created_at=_utcnow(),
            updated_at=_utcnow(),
        )
        db.add(record)
        db.flush()
        return record

    def list_resources(
        self,
        db: Session,
        *,
        sensitivity_level: str | None = None,
        source: str | None = None,
    ) -> list[SensitiveResourceRecord]:
        return list_resources(
            db,
            sensitivity_level=sensitivity_level,
            source=source,
        )

    def list_access_requests(
        self,
        db: Session,
        *,
        decision: str | None = None,
        requester_type: str | None = None,
        run_id: str | None = None,
        node_run_id: str | None = None,
        access_request_id: str | None = None,
    ) -> list[SensitiveAccessRequestRecord]:
        return list_access_requests(
            db,
            decision=decision,
            requester_type=requester_type,
            run_id=run_id,
            node_run_id=node_run_id,
            access_request_id=access_request_id,
        )

    def list_approval_tickets(
        self,
        db: Session,
        *,
        status: str | None = None,
        waiting_status: str | None = None,
        run_id: str | None = None,
        node_run_id: str | None = None,
        access_request_id: str | None = None,
        approval_ticket_id: str | None = None,
    ) -> list[ApprovalTicketRecord]:
        return list_approval_tickets(
            db,
            status=status,
            waiting_status=waiting_status,
            run_id=run_id,
            node_run_id=node_run_id,
            access_request_id=access_request_id,
            approval_ticket_id=approval_ticket_id,
        )

    def list_notification_dispatches(
        self,
        db: Session,
        *,
        approval_ticket_id: str | None = None,
        run_id: str | None = None,
        node_run_id: str | None = None,
        access_request_id: str | None = None,
        status: str | None = None,
        channel: str | None = None,
    ) -> list[NotificationDispatchRecord]:
        return list_notification_dispatches(
            db,
            approval_ticket_id=approval_ticket_id,
            run_id=run_id,
            node_run_id=node_run_id,
            access_request_id=access_request_id,
            status=status,
            channel=channel,
        )

    def _create_notification_dispatch(
        self,
        *,
        approval_ticket_id: str,
        channel: str,
        target: str,
    ) -> NotificationDispatchRecord:
        created_at = _utcnow()
        preflight = evaluate_notification_dispatch_preflight(
            channel=channel,
            target=target,
            settings=self._settings,
        )
        if preflight.status == "delivered":
            return NotificationDispatchRecord(
                id=str(uuid4()),
                approval_ticket_id=approval_ticket_id,
                channel=channel,
                target=preflight.normalized_target,
                status="delivered",
                delivered_at=created_at,
                error=None,
                created_at=created_at,
            )

        return NotificationDispatchRecord(
            id=str(uuid4()),
            approval_ticket_id=approval_ticket_id,
            channel=channel,
            target=preflight.normalized_target,
            status=preflight.status,
            delivered_at=None,
            error=preflight.error,
            created_at=created_at,
        )

    def find_credential_resource(
        self,
        db: Session,
        *,
        credential_id: str,
    ) -> SensitiveResourceRecord | None:
        return find_credential_resource(db, credential_id=credential_id)

    def find_workflow_context_resource(
        self,
        db: Session,
        *,
        run_id: str | None,
        source_node_id: str,
        artifact_type: str,
    ) -> SensitiveResourceRecord | None:
        return find_workflow_context_resource(
            db,
            run_id=run_id,
            source_node_id=source_node_id,
            artifact_type=artifact_type,
        )

    def find_tool_resource(
        self,
        db: Session,
        *,
        run_id: str | None,
        tool_id: str,
        ecosystem: str | None = None,
        adapter_id: str | None = None,
    ) -> SensitiveResourceRecord | None:
        return find_tool_resource(
            db,
            run_id=run_id,
            tool_id=tool_id,
            ecosystem=ecosystem,
            adapter_id=adapter_id,
        )

    def ensure_access(
        self,
        db: Session,
        *,
        run_id: str | None,
        node_run_id: str | None,
        requester_type: str,
        requester_id: str,
        resource_id: str,
        action_type: str,
        purpose_text: str | None = None,
        notification_channel: str = "in_app",
        notification_target: str = "sensitive-access-inbox",
        reuse_existing: bool = True,
    ) -> SensitiveAccessRequestBundle:
        if reuse_existing:
            existing_bundle = find_existing_access_bundle(
                db,
                run_id=run_id,
                node_run_id=node_run_id,
                requester_type=requester_type,
                requester_id=requester_id,
                resource_id=resource_id,
                action_type=action_type,
            )
            if existing_bundle is not None:
                return existing_bundle

        return self.request_access(
            db,
            run_id=run_id,
            node_run_id=node_run_id,
            requester_type=requester_type,
            requester_id=requester_id,
            resource_id=resource_id,
            action_type=action_type,
            purpose_text=purpose_text,
            notification_channel=notification_channel,
            notification_target=notification_target,
        )

    def request_access(
        self,
        db: Session,
        *,
        run_id: str | None,
        node_run_id: str | None,
        requester_type: str,
        requester_id: str,
        resource_id: str,
        action_type: str,
        purpose_text: str | None = None,
        notification_channel: str = "in_app",
        notification_target: str = "sensitive-access-inbox",
    ) -> SensitiveAccessRequestBundle:
        resource = db.get(SensitiveResourceRecord, resource_id)
        if resource is None:
            raise SensitiveAccessControlError("Sensitive resource not found.")

        validate_runtime_scope(
            db,
            run_id=run_id,
            node_run_id=node_run_id,
        )

        decision_result = evaluate_default_sensitive_access_policy(
            sensitivity_level=resource.sensitivity_level,
            requester_type=requester_type,
            action_type=action_type,
        )

        access_request = SensitiveAccessRequestRecord(
            id=str(uuid4()),
            run_id=run_id,
            node_run_id=node_run_id,
            requester_type=requester_type,
            requester_id=requester_id.strip(),
            resource_id=resource.id,
            action_type=action_type,
            purpose_text=purpose_text,
            decision=decision_result.decision,
            reason_code=decision_result.reason_code,
            created_at=_utcnow(),
            decided_at=_utcnow() if decision_result.decision != "require_approval" else None,
        )
        db.add(access_request)
        db.flush()

        approval_ticket = None
        notifications: list[NotificationDispatchRecord] = []
        if decision_result.decision == "require_approval":
            approval_ticket_created_at = _utcnow()
            approval_ticket = ApprovalTicketRecord(
                id=str(uuid4()),
                access_request_id=access_request.id,
                run_id=run_id,
                node_run_id=node_run_id,
                status="pending",
                waiting_status="waiting",
                approved_by=None,
                decided_at=None,
                expires_at=self._compute_approval_ticket_expires_at(
                    approval_ticket_created_at
                ),
                created_at=approval_ticket_created_at,
            )
            db.add(approval_ticket)
            db.flush()
            notifications.append(
                self._create_notification_dispatch(
                    approval_ticket_id=approval_ticket.id,
                    channel=notification_channel,
                    target=notification_target,
                )
            )
            db.add_all(notifications)
            db.flush()
            for notification in notifications:
                if notification.status == "pending":
                    self._notification_dispatch_scheduler.schedule(
                        dispatch_id=notification.id,
                        source="sensitive_access_request",
                        db=db,
                    )

        return SensitiveAccessRequestBundle(
            resource=resource,
            access_request=access_request,
            approval_ticket=approval_ticket,
            notifications=notifications,
        )

    def decide_ticket(
        self,
        db: Session,
        *,
        ticket_id: str,
        status: str,
        approved_by: str,
    ) -> ApprovalDecisionBundle:
        approval_ticket = db.get(ApprovalTicketRecord, ticket_id)
        if approval_ticket is None:
            raise SensitiveAccessControlError("Approval ticket not found.")
        if approval_ticket.status != "pending":
            raise SensitiveAccessControlError("Only pending approval tickets can be decided.")

        access_request = db.get(SensitiveAccessRequestRecord, approval_ticket.access_request_id)
        if access_request is None:
            raise SensitiveAccessControlError("Sensitive access request not found for ticket.")

        notifications = self.list_notification_dispatches(
            db,
            approval_ticket_id=approval_ticket.id,
        )

        decided_at = _utcnow()
        if self._is_approval_ticket_expired(approval_ticket, now=decided_at):
            self._expire_approval_ticket(
                db,
                approval_ticket=approval_ticket,
                access_request=access_request,
                notifications=notifications,
                decided_at=decided_at,
                source="sensitive_access_expiry",
            )
            raise SensitiveAccessTicketExpiredError("Approval ticket expired.")

        self._resolve_approval_ticket(
            db,
            approval_ticket=approval_ticket,
            access_request=access_request,
            notifications=notifications,
            status=status,
            waiting_status="resumed" if status == "approved" else "failed",
            approved_by=approved_by.strip(),
            decided_at=decided_at,
            reason_code=(
                "approved_after_review" if status == "approved" else "rejected_after_review"
            ),
            resume_source="sensitive_access_decision",
            notification_resolution=(
                "Approval ticket approved before notification delivery."
                if status == "approved"
                else "Approval ticket rejected before notification delivery."
            ),
        )
        return ApprovalDecisionBundle(
            access_request=access_request,
            approval_ticket=approval_ticket,
            notifications=notifications,
        )

    def expire_pending_tickets(
        self,
        db: Session,
        *,
        source: str = "sensitive_access_expiry",
        limit: int | None = None,
        now: datetime | None = None,
    ) -> ApprovalTicketExpiryResult:
        effective_limit = max(
            int(limit or self._settings.approval_ticket_expiry_batch_size),
            1,
        )
        effective_now = now or _utcnow()
        tickets = list(
            db.scalars(
                select(ApprovalTicketRecord)
                .where(
                    ApprovalTicketRecord.status == "pending",
                    ApprovalTicketRecord.waiting_status == "waiting",
                    ApprovalTicketRecord.expires_at.is_not(None),
                    ApprovalTicketRecord.expires_at <= effective_now,
                )
                .order_by(
                    ApprovalTicketRecord.expires_at.asc(),
                    ApprovalTicketRecord.created_at.asc(),
                    ApprovalTicketRecord.id.asc(),
                )
                .limit(effective_limit)
            )
        )

        run_ids: list[str] = []
        ticket_ids: list[str] = []
        items: list[ApprovalTicketExpiryItem] = []
        seen_run_ids: set[str] = set()
        for approval_ticket in tickets:
            access_request = db.get(
                SensitiveAccessRequestRecord,
                approval_ticket.access_request_id,
            )
            if access_request is None:
                raise SensitiveAccessControlError(
                    "Sensitive access request not found for ticket."
                )
            notifications = self.list_notification_dispatches(
                db,
                approval_ticket_id=approval_ticket.id,
            )
            self._expire_approval_ticket(
                db,
                approval_ticket=approval_ticket,
                access_request=access_request,
                notifications=notifications,
                decided_at=effective_now,
                source=source,
            )
            ticket_ids.append(approval_ticket.id)
            if approval_ticket.run_id and approval_ticket.run_id not in seen_run_ids:
                seen_run_ids.add(approval_ticket.run_id)
                run_ids.append(approval_ticket.run_id)
            items.append(
                ApprovalTicketExpiryItem(
                    ticket_id=approval_ticket.id,
                    access_request_id=approval_ticket.access_request_id,
                    run_id=approval_ticket.run_id,
                    node_run_id=approval_ticket.node_run_id,
                    expires_at=approval_ticket.expires_at,
                    notification_ids=[notification.id for notification in notifications],
                )
            )

        return ApprovalTicketExpiryResult(
            source=source,
            limit=effective_limit,
            matched_count=len(tickets),
            expired_count=len(ticket_ids),
            scheduled_resume_count=len(run_ids),
            ticket_ids=ticket_ids,
            run_ids=run_ids,
            items=items,
        )

    def retry_notification_dispatch(
        self,
        db: Session,
        *,
        dispatch_id: str,
        target_override: str | None = None,
    ) -> NotificationDispatchRetryBundle:
        notification = db.get(NotificationDispatchRecord, dispatch_id)
        if notification is None:
            raise SensitiveAccessControlError("Notification dispatch not found.")

        approval_ticket = db.get(ApprovalTicketRecord, notification.approval_ticket_id)
        if approval_ticket is None:
            raise SensitiveAccessControlError(
                "Approval ticket not found for notification dispatch."
            )
        if approval_ticket.status != "pending" or approval_ticket.waiting_status != "waiting":
            raise SensitiveAccessControlError(
                "Only waiting approval tickets can retry notifications."
            )

        notifications = self.list_notification_dispatches(
            db,
            approval_ticket_id=approval_ticket.id,
        )
        if not notifications or notifications[0].id != notification.id:
            raise SensitiveAccessControlError(
                "Only the latest notification dispatch can be retried."
            )
        if notification.status == "delivered":
            raise SensitiveAccessControlError(
                "Delivered notification dispatches do not need retry."
            )

        retried_notification = self._create_notification_dispatch(
            approval_ticket_id=approval_ticket.id,
            channel=notification.channel,
            target=target_override or notification.target,
        )
        if notification.status == "pending":
            notification.status = "failed"
            notification.error = f"Superseded by manual retry {retried_notification.id}."

        db.add(retried_notification)
        db.flush()
        if retried_notification.status == "pending":
            self._notification_dispatch_scheduler.schedule(
                dispatch_id=retried_notification.id,
                source="sensitive_access_retry",
                db=db,
            )
        return NotificationDispatchRetryBundle(
            approval_ticket=approval_ticket,
            notification=retried_notification,
        )

    def _compute_approval_ticket_expires_at(
        self,
        created_at: datetime,
    ) -> datetime | None:
        ttl_seconds = max(int(self._settings.approval_ticket_ttl_seconds), 0)
        if ttl_seconds <= 0:
            return None
        return created_at + timedelta(seconds=ttl_seconds)

    def _is_approval_ticket_expired(
        self,
        approval_ticket: ApprovalTicketRecord,
        *,
        now: datetime,
    ) -> bool:
        expires_at = _normalize_datetime(approval_ticket.expires_at)
        effective_now = _normalize_datetime(now)
        return (
            approval_ticket.status == "pending"
            and approval_ticket.waiting_status == "waiting"
            and expires_at is not None
            and effective_now is not None
            and expires_at <= effective_now
        )

    def _expire_approval_ticket(
        self,
        db: Session,
        *,
        approval_ticket: ApprovalTicketRecord,
        access_request: SensitiveAccessRequestRecord,
        notifications: list[NotificationDispatchRecord],
        decided_at: datetime,
        source: str,
    ) -> None:
        self._resolve_approval_ticket(
            db,
            approval_ticket=approval_ticket,
            access_request=access_request,
            notifications=notifications,
            status="expired",
            waiting_status="failed",
            approved_by=None,
            decided_at=decided_at,
            reason_code="approval_expired",
            resume_source=source,
            notification_resolution="Approval ticket expired before notification delivery.",
        )

    def _resolve_approval_ticket(
        self,
        db: Session,
        *,
        approval_ticket: ApprovalTicketRecord,
        access_request: SensitiveAccessRequestRecord,
        notifications: list[NotificationDispatchRecord],
        status: str,
        waiting_status: str,
        approved_by: str | None,
        decided_at: datetime,
        reason_code: str,
        resume_source: str,
        notification_resolution: str,
    ) -> None:
        approval_ticket.status = status
        approval_ticket.waiting_status = waiting_status
        approval_ticket.approved_by = approved_by
        approval_ticket.decided_at = decided_at

        access_request.decision = "allow" if status == "approved" else "deny"
        access_request.reason_code = reason_code
        access_request.decided_at = decided_at

        self._mark_pending_notifications_failed(
            notifications,
            error=notification_resolution,
        )

        if approval_ticket.run_id:
            self._resume_scheduler.schedule(
                run_id=approval_ticket.run_id,
                reason=f"Sensitive access ticket {approval_ticket.id} {status}",
                source=resume_source,
                db=db,
            )

    def _mark_pending_notifications_failed(
        self,
        notifications: list[NotificationDispatchRecord],
        *,
        error: str,
    ) -> None:
        for notification in notifications:
            if notification.status != "pending":
                continue
            notification.status = "failed"
            notification.delivered_at = None
            notification.error = error
