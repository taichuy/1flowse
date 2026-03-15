import json

import httpx
from sqlalchemy.orm import Session

from app.services.notification_delivery import NotificationDeliveryService
from app.services.notification_dispatch_scheduler import NotificationDispatchScheduler
from app.services.run_resume_scheduler import RunResumeScheduler
from app.services.sensitive_access_control import SensitiveAccessControlService


def _create_high_sensitivity_resource(
    service: SensitiveAccessControlService,
    sqlite_session: Session,
    *,
    label: str,
) -> str:
    resource = service.create_resource(
        sqlite_session,
        label=label,
        sensitivity_level="L3",
        source="workspace_resource",
        metadata={"path": "/exports/prod.csv"},
    )
    sqlite_session.commit()
    return resource.id


def test_notification_delivery_service_delivers_webhook_dispatch(
    sqlite_session: Session,
) -> None:
    sent_payloads: list[dict] = []

    def handler(request: httpx.Request) -> httpx.Response:
        sent_payloads.append(json.loads(request.content.decode("utf-8")))
        return httpx.Response(204)

    def client_factory() -> httpx.Client:
        return httpx.Client(transport=httpx.MockTransport(handler))

    service = SensitiveAccessControlService(
        resume_scheduler=RunResumeScheduler(dispatcher=lambda _request: None),
        notification_dispatch_scheduler=NotificationDispatchScheduler(
            dispatcher=lambda _request: None
        ),
    )
    resource_id = _create_high_sensitivity_resource(
        service,
        sqlite_session,
        label="Webhook export",
    )

    bundle = service.request_access(
        sqlite_session,
        run_id=None,
        node_run_id=None,
        requester_type="ai",
        requester_id="assistant-export",
        resource_id=resource_id,
        action_type="read",
        purpose_text="notify operator for export review",
        notification_channel="webhook",
        notification_target="https://hooks.example.test/notify",
    )
    sqlite_session.commit()

    notification = bundle.notifications[0]
    assert notification.status == "pending"

    context = NotificationDeliveryService(client_factory=client_factory).deliver_dispatch(
        sqlite_session,
        dispatch_id=notification.id,
    )

    assert context.notification.status == "delivered"
    assert context.notification.delivered_at is not None
    assert context.notification.error is None
    assert len(sent_payloads) == 1
    assert sent_payloads[0]["dispatchId"] == notification.id
    assert sent_payloads[0]["approvalTicket"]["id"] == bundle.approval_ticket.id


def test_notification_delivery_service_marks_webhook_failure(
    sqlite_session: Session,
) -> None:
    def handler(_request: httpx.Request) -> httpx.Response:
        return httpx.Response(503, text="service unavailable")

    def client_factory() -> httpx.Client:
        return httpx.Client(transport=httpx.MockTransport(handler))

    service = SensitiveAccessControlService(
        resume_scheduler=RunResumeScheduler(dispatcher=lambda _request: None),
        notification_dispatch_scheduler=NotificationDispatchScheduler(
            dispatcher=lambda _request: None
        ),
    )
    resource_id = _create_high_sensitivity_resource(
        service,
        sqlite_session,
        label="Webhook export failure",
    )

    bundle = service.request_access(
        sqlite_session,
        run_id=None,
        node_run_id=None,
        requester_type="ai",
        requester_id="assistant-export",
        resource_id=resource_id,
        action_type="read",
        purpose_text="notify operator for export review",
        notification_channel="webhook",
        notification_target="https://hooks.example.test/notify",
    )
    sqlite_session.commit()

    context = NotificationDeliveryService(client_factory=client_factory).deliver_dispatch(
        sqlite_session,
        dispatch_id=bundle.notifications[0].id,
    )

    assert context.notification.status == "failed"
    assert context.notification.delivered_at is None
    assert "Webhook delivery failed" in (context.notification.error or "")
