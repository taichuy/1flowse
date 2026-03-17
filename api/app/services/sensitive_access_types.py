from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime

from app.models.sensitive_access import (
    ApprovalTicketRecord,
    NotificationDispatchRecord,
    SensitiveAccessRequestRecord,
    SensitiveResourceRecord,
)


class SensitiveAccessControlError(RuntimeError):
    pass


class SensitiveAccessTicketExpiredError(SensitiveAccessControlError):
    pass


@dataclass(frozen=True)
class AccessDecisionResult:
    decision: str
    reason_code: str


@dataclass(frozen=True)
class SensitiveAccessRequestBundle:
    resource: SensitiveResourceRecord
    access_request: SensitiveAccessRequestRecord
    approval_ticket: ApprovalTicketRecord | None = None
    notifications: list[NotificationDispatchRecord] = field(default_factory=list)


@dataclass(frozen=True)
class ApprovalDecisionBundle:
    access_request: SensitiveAccessRequestRecord
    approval_ticket: ApprovalTicketRecord
    notifications: list[NotificationDispatchRecord] = field(default_factory=list)


@dataclass(frozen=True)
class NotificationDispatchRetryBundle:
    approval_ticket: ApprovalTicketRecord
    notification: NotificationDispatchRecord


@dataclass(frozen=True)
class ApprovalTicketExpiryItem:
    ticket_id: str
    access_request_id: str
    run_id: str | None
    node_run_id: str | None
    expires_at: datetime | None
    notification_ids: list[str] = field(default_factory=list)


@dataclass(frozen=True)
class ApprovalTicketExpiryResult:
    source: str
    limit: int
    matched_count: int
    expired_count: int
    scheduled_resume_count: int
    ticket_ids: list[str] = field(default_factory=list)
    run_ids: list[str] = field(default_factory=list)
    items: list[ApprovalTicketExpiryItem] = field(default_factory=list)
