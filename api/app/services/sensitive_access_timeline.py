from __future__ import annotations

from collections import Counter, defaultdict
from collections.abc import Sequence
from dataclasses import dataclass

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.sensitive_access import (
    ApprovalTicketRecord,
    NotificationDispatchRecord,
    SensitiveAccessRequestRecord,
    SensitiveResourceRecord,
)
from app.services.sensitive_access_types import SensitiveAccessRequestBundle


@dataclass(frozen=True)
class SensitiveAccessTimelineSnapshot:
    bundles: list[SensitiveAccessRequestBundle]
    by_node_run: dict[str, list[SensitiveAccessRequestBundle]]
    request_count: int = 0
    approval_ticket_count: int = 0
    notification_count: int = 0
    decision_counts: dict[str, int] | None = None
    approval_status_counts: dict[str, int] | None = None
    notification_status_counts: dict[str, int] | None = None


def _empty_timeline_snapshot() -> SensitiveAccessTimelineSnapshot:
    return SensitiveAccessTimelineSnapshot(
        bundles=[],
        by_node_run={},
        decision_counts={},
        approval_status_counts={},
        notification_status_counts={},
    )


def _normalize_run_ids(run_ids: Sequence[str]) -> tuple[str, ...]:
    return tuple(dict.fromkeys(str(run_id).strip() for run_id in run_ids if str(run_id).strip()))


def _build_sensitive_access_timeline_snapshots(
    db: Session,
    *,
    access_requests: list[SensitiveAccessRequestRecord],
    run_ids: Sequence[str],
) -> dict[str, SensitiveAccessTimelineSnapshot]:
    normalized_run_ids = _normalize_run_ids(run_ids)
    if not access_requests:
        return {run_id: _empty_timeline_snapshot() for run_id in normalized_run_ids}

    resource_ids = {request.resource_id for request in access_requests}
    resources = {
        record.id: record
        for record in db.scalars(
            select(SensitiveResourceRecord).where(
                SensitiveResourceRecord.id.in_(resource_ids)
            )
        ).all()
    }

    access_request_ids = [request.id for request in access_requests]
    approval_tickets = db.scalars(
        select(ApprovalTicketRecord)
        .where(ApprovalTicketRecord.access_request_id.in_(access_request_ids))
        .order_by(ApprovalTicketRecord.created_at.asc(), ApprovalTicketRecord.id.asc())
    ).all()
    approval_tickets_by_request_id = {
        ticket.access_request_id: ticket for ticket in approval_tickets
    }

    notifications_by_ticket_id: dict[str, list[NotificationDispatchRecord]] = defaultdict(list)
    approval_ticket_ids = [ticket.id for ticket in approval_tickets]
    if approval_ticket_ids:
        notifications = db.scalars(
            select(NotificationDispatchRecord)
            .where(NotificationDispatchRecord.approval_ticket_id.in_(approval_ticket_ids))
            .order_by(
                NotificationDispatchRecord.created_at.asc(),
                NotificationDispatchRecord.id.asc(),
            )
        ).all()
        for notification in notifications:
            notifications_by_ticket_id[notification.approval_ticket_id].append(notification)

    bundles_by_run: dict[str, list[SensitiveAccessRequestBundle]] = defaultdict(list)
    by_node_run_by_run: dict[str, dict[str, list[SensitiveAccessRequestBundle]]] = defaultdict(
        lambda: defaultdict(list)
    )
    decision_counts_by_run: dict[str, Counter[str]] = defaultdict(Counter)
    approval_status_counts_by_run: dict[str, Counter[str]] = defaultdict(Counter)
    notification_status_counts_by_run: dict[str, Counter[str]] = defaultdict(Counter)
    notification_count_by_run: Counter[str] = Counter()

    for access_request in access_requests:
        resource = resources.get(access_request.resource_id)
        if resource is None:
            continue

        run_id = str(access_request.run_id)
        approval_ticket = approval_tickets_by_request_id.get(access_request.id)
        notifications = (
            notifications_by_ticket_id.get(approval_ticket.id, [])
            if approval_ticket is not None
            else []
        )
        bundle = SensitiveAccessRequestBundle(
            resource=resource,
            access_request=access_request,
            approval_ticket=approval_ticket,
            notifications=notifications,
        )
        bundles_by_run[run_id].append(bundle)
        decision_counts_by_run[run_id][str(access_request.decision or "pending")] += 1
        if approval_ticket is not None:
            approval_status_counts_by_run[run_id][approval_ticket.status] += 1
        for notification in notifications:
            notification_status_counts_by_run[run_id][notification.status] += 1
        notification_count_by_run[run_id] += len(notifications)

        if access_request.node_run_id:
            by_node_run_by_run[run_id][str(access_request.node_run_id)].append(bundle)

    return {
        run_id: SensitiveAccessTimelineSnapshot(
            bundles=bundles_by_run.get(run_id, []),
            by_node_run=dict(by_node_run_by_run.get(run_id, {})),
            request_count=len(bundles_by_run.get(run_id, [])),
            approval_ticket_count=sum(
                1
                for bundle in bundles_by_run.get(run_id, [])
                if bundle.approval_ticket is not None
            ),
            notification_count=notification_count_by_run.get(run_id, 0),
            decision_counts=dict(sorted(decision_counts_by_run.get(run_id, Counter()).items())),
            approval_status_counts=dict(
                sorted(approval_status_counts_by_run.get(run_id, Counter()).items())
            ),
            notification_status_counts=dict(
                sorted(notification_status_counts_by_run.get(run_id, Counter()).items())
            ),
        )
        for run_id in normalized_run_ids
    }


def load_sensitive_access_timelines(
    db: Session,
    *,
    run_ids: Sequence[str],
    scoped_to_node_runs: bool = True,
) -> dict[str, SensitiveAccessTimelineSnapshot]:
    normalized_run_ids = _normalize_run_ids(run_ids)
    if not normalized_run_ids:
        return {}

    statement = select(SensitiveAccessRequestRecord).where(
        SensitiveAccessRequestRecord.run_id.in_(normalized_run_ids)
    )
    if scoped_to_node_runs:
        statement = statement.where(SensitiveAccessRequestRecord.node_run_id.is_not(None))

    access_requests = db.scalars(
        statement.order_by(
            SensitiveAccessRequestRecord.created_at.asc(),
            SensitiveAccessRequestRecord.id.asc(),
        )
    ).all()
    return _build_sensitive_access_timeline_snapshots(
        db,
        access_requests=access_requests,
        run_ids=normalized_run_ids,
    )


def load_sensitive_access_timeline(
    db: Session,
    *,
    run_id: str,
    scoped_to_node_runs: bool = True,
) -> SensitiveAccessTimelineSnapshot:
    return load_sensitive_access_timelines(
        db,
        run_ids=[run_id],
        scoped_to_node_runs=scoped_to_node_runs,
    ).get(run_id, _empty_timeline_snapshot())
