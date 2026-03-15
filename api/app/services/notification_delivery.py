from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Any, Protocol
from urllib.parse import urlparse

import httpx
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models.sensitive_access import (
    ApprovalTicketRecord,
    NotificationDispatchRecord,
    SensitiveAccessRequestRecord,
    SensitiveResourceRecord,
)


class NotificationDeliveryError(RuntimeError):
    pass


@dataclass(frozen=True)
class NotificationDeliveryContext:
    notification: NotificationDispatchRecord
    approval_ticket: ApprovalTicketRecord
    access_request: SensitiveAccessRequestRecord
    resource: SensitiveResourceRecord | None = None


@dataclass(frozen=True)
class NotificationDeliveryOutcome:
    status: str
    delivered_at: datetime | None = None
    error: str | None = None


NotificationClientFactory = Callable[[], httpx.Client]


def _utcnow() -> datetime:
    return datetime.now(UTC)


def _is_http_target(target: str) -> bool:
    parsed = urlparse(target.strip())
    return parsed.scheme in {"http", "https"} and bool(parsed.netloc)


def _build_notification_text(context: NotificationDeliveryContext) -> str:
    resource_label = (
        context.resource.label
        if context.resource is not None
        else context.access_request.resource_id
    )
    run_id = context.approval_ticket.run_id or context.access_request.run_id or "unknown"
    purpose_text = context.access_request.purpose_text or "No purpose provided."
    return (
        "7Flows approval required: "
        f"{context.access_request.requester_type} {context.access_request.requester_id} "
        f"requested {context.access_request.action_type} on {resource_label}. "
        f"ticket={context.approval_ticket.id} run={run_id} purpose={purpose_text}"
    )


def _build_webhook_payload(
    context: NotificationDeliveryContext,
) -> dict[str, Any]:
    resource: dict[str, Any] | None = None
    if context.resource is not None:
        resource = {
            "id": context.resource.id,
            "label": context.resource.label,
            "description": context.resource.description,
            "sensitivityLevel": context.resource.sensitivity_level,
            "source": context.resource.source,
            "metadata": context.resource.metadata_payload or {},
        }
    return {
        "message": _build_notification_text(context),
        "dispatchId": context.notification.id,
        "channel": context.notification.channel,
        "approvalTicket": {
            "id": context.approval_ticket.id,
            "status": context.approval_ticket.status,
            "waitingStatus": context.approval_ticket.waiting_status,
            "runId": context.approval_ticket.run_id,
            "nodeRunId": context.approval_ticket.node_run_id,
            "createdAt": context.approval_ticket.created_at.isoformat(),
            "expiresAt": (
                context.approval_ticket.expires_at.isoformat()
                if context.approval_ticket.expires_at is not None
                else None
            ),
        },
        "accessRequest": {
            "id": context.access_request.id,
            "runId": context.access_request.run_id,
            "nodeRunId": context.access_request.node_run_id,
            "requesterType": context.access_request.requester_type,
            "requesterId": context.access_request.requester_id,
            "actionType": context.access_request.action_type,
            "purposeText": context.access_request.purpose_text,
            "decision": context.access_request.decision,
            "reasonCode": context.access_request.reason_code,
            "createdAt": context.access_request.created_at.isoformat(),
        },
        "resource": resource,
    }


class NotificationAdapter(Protocol):
    def deliver(
        self,
        context: NotificationDeliveryContext,
    ) -> NotificationDeliveryOutcome: ...


class InAppNotificationAdapter:
    def deliver(
        self,
        context: NotificationDeliveryContext,
    ) -> NotificationDeliveryOutcome:
        return NotificationDeliveryOutcome(
            status="delivered",
            delivered_at=_utcnow(),
        )


class WebhookNotificationAdapter:
    def __init__(self, *, client_factory: NotificationClientFactory) -> None:
        self._client_factory = client_factory

    def deliver(
        self,
        context: NotificationDeliveryContext,
    ) -> NotificationDeliveryOutcome:
        target = context.notification.target.strip()
        if not _is_http_target(target):
            return NotificationDeliveryOutcome(
                status="failed",
                error="Webhook notification target must be an http(s) URL.",
            )
        payload = _build_webhook_payload(context)
        try:
            with self._client_factory() as client:
                response = client.post(target, json=payload)
                response.raise_for_status()
        except httpx.HTTPError as exc:
            return NotificationDeliveryOutcome(
                status="failed",
                error=f"Webhook delivery failed: {exc}",
            )
        return NotificationDeliveryOutcome(
            status="delivered",
            delivered_at=_utcnow(),
        )


class SlackNotificationAdapter:
    def __init__(self, *, client_factory: NotificationClientFactory) -> None:
        self._client_factory = client_factory

    def deliver(
        self,
        context: NotificationDeliveryContext,
    ) -> NotificationDeliveryOutcome:
        target = context.notification.target.strip()
        if not _is_http_target(target):
            return NotificationDeliveryOutcome(
                status="failed",
                error=(
                    "Slack delivery requires the notification target to be an incoming webhook URL."
                ),
            )
        payload = {"text": _build_notification_text(context)}
        try:
            with self._client_factory() as client:
                response = client.post(target, json=payload)
                response.raise_for_status()
        except httpx.HTTPError as exc:
            return NotificationDeliveryOutcome(
                status="failed",
                error=f"Slack delivery failed: {exc}",
            )
        return NotificationDeliveryOutcome(
            status="delivered",
            delivered_at=_utcnow(),
        )


class FeishuNotificationAdapter:
    def __init__(self, *, client_factory: NotificationClientFactory) -> None:
        self._client_factory = client_factory

    def deliver(
        self,
        context: NotificationDeliveryContext,
    ) -> NotificationDeliveryOutcome:
        target = context.notification.target.strip()
        if not _is_http_target(target):
            return NotificationDeliveryOutcome(
                status="failed",
                error=(
                    "Feishu delivery requires the notification target to be a bot webhook URL."
                ),
            )
        payload = {
            "msg_type": "text",
            "content": {"text": _build_notification_text(context)},
        }
        try:
            with self._client_factory() as client:
                response = client.post(target, json=payload)
                response.raise_for_status()
        except httpx.HTTPError as exc:
            return NotificationDeliveryOutcome(
                status="failed",
                error=f"Feishu delivery failed: {exc}",
            )
        return NotificationDeliveryOutcome(
            status="delivered",
            delivered_at=_utcnow(),
        )


class EmailNotificationAdapter:
    def deliver(
        self,
        context: NotificationDeliveryContext,
    ) -> NotificationDeliveryOutcome:
        return NotificationDeliveryOutcome(
            status="failed",
            error=(
                "Email delivery adapter is not configured yet; "
                "bridge it via webhook or add a dedicated mail provider adapter."
            ),
        )


class NotificationDeliveryService:
    def __init__(
        self,
        *,
        client_factory: NotificationClientFactory | None = None,
        timeout_seconds: float | None = None,
    ) -> None:
        settings = get_settings()
        self._timeout_seconds = (
            timeout_seconds
            if timeout_seconds is not None
            else settings.notification_delivery_timeout_seconds
        )
        self._client_factory = client_factory or self._make_client
        self._adapters: dict[str, NotificationAdapter] = {
            "in_app": InAppNotificationAdapter(),
            "webhook": WebhookNotificationAdapter(client_factory=self._client_factory),
            "slack": SlackNotificationAdapter(client_factory=self._client_factory),
            "feishu": FeishuNotificationAdapter(client_factory=self._client_factory),
            "email": EmailNotificationAdapter(),
        }

    def deliver_dispatch(
        self,
        db: Session,
        *,
        dispatch_id: str,
    ) -> NotificationDeliveryContext:
        context = self._load_context(db, dispatch_id=dispatch_id)
        if (
            context.notification.status == "delivered"
            and context.notification.delivered_at is not None
        ):
            return context

        adapter = self._adapters.get(context.notification.channel)
        if adapter is None:
            outcome = NotificationDeliveryOutcome(
                status="failed",
                error=(
                    f"Notification channel '{context.notification.channel}' is not registered."
                ),
            )
        else:
            outcome = adapter.deliver(context)

        context.notification.status = outcome.status
        context.notification.delivered_at = (
            outcome.delivered_at if outcome.status == "delivered" else None
        )
        context.notification.error = None if outcome.status == "delivered" else outcome.error
        db.flush()
        return context

    def _load_context(
        self,
        db: Session,
        *,
        dispatch_id: str,
    ) -> NotificationDeliveryContext:
        notification = db.get(NotificationDispatchRecord, dispatch_id)
        if notification is None:
            raise NotificationDeliveryError("Notification dispatch not found.")

        approval_ticket = db.get(ApprovalTicketRecord, notification.approval_ticket_id)
        if approval_ticket is None:
            raise NotificationDeliveryError(
                "Approval ticket not found for notification dispatch."
            )

        access_request = db.get(
            SensitiveAccessRequestRecord,
            approval_ticket.access_request_id,
        )
        if access_request is None:
            raise NotificationDeliveryError(
                "Sensitive access request not found for notification dispatch."
            )

        resource = db.get(SensitiveResourceRecord, access_request.resource_id)
        return NotificationDeliveryContext(
            notification=notification,
            approval_ticket=approval_ticket,
            access_request=access_request,
            resource=resource,
        )

    def _make_client(self) -> httpx.Client:
        return httpx.Client(
            timeout=httpx.Timeout(self._timeout_seconds, connect=10.0),
            follow_redirects=True,
        )
