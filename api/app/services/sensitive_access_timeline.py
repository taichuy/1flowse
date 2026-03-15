from __future__ import annotations

from collections import Counter, defaultdict
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


def load_sensitive_access_timeline(
    db: Session,
    *,
    run_id: str,
    scoped_to_node_runs: bool = True,
) -> SensitiveAccessTimelineSnapshot:
    statement = select(SensitiveAccessRequestRecord).where(
        SensitiveAccessRequestRecord.run_id == run_id
    )
    if scoped_to_node_runs:
        statement = statement.where(SensitiveAccessRequestRecord.node_run_id.is_not(None))

    access_requests = db.scalars(
        statement.order_by(
            SensitiveAccessRequestRecord.created_at.asc(),
            SensitiveAccessRequestRecord.id.asc(),
        )
    ).all()
    if not access_requests:
        return SensitiveAccessTimelineSnapshot(
            bundles=[],
            by_node_run={},
            decision_counts={},
            approval_status_counts={},
            notification_status_counts={},
        )

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

    notification_status_counts: Counter[str] = Counter()
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
            notification_status_counts[notification.status] += 1

    decision_counts: Counter[str] = Counter()
    approval_status_counts: Counter[str] = Counter()
    bundles: list[SensitiveAccessRequestBundle] = []
    by_node_run: dict[str, list[SensitiveAccessRequestBundle]] = defaultdict(list)
    notification_count = 0

    for access_request in access_requests:
        resource = resources.get(access_request.resource_id)
        if resource is None:
            continue

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
        bundles.append(bundle)

        decision_counts[str(access_request.decision or "pending")] += 1
        if approval_ticket is not None:
            approval_status_counts[approval_ticket.status] += 1
        notification_count += len(notifications)

        if access_request.node_run_id:
            by_node_run[str(access_request.node_run_id)].append(bundle)

    return SensitiveAccessTimelineSnapshot(
        bundles=bundles,
        by_node_run=dict(by_node_run),
        request_count=len(bundles),
        approval_ticket_count=sum(
            1 for bundle in bundles if bundle.approval_ticket is not None
        ),
        notification_count=notification_count,
        decision_counts=dict(sorted(decision_counts.items())),
        approval_status_counts=dict(sorted(approval_status_counts.items())),
        notification_status_counts=dict(sorted(notification_status_counts.items())),
    )
