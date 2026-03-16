from __future__ import annotations

from fastapi import status
from fastapi.responses import JSONResponse

from app.services.sensitive_access_reasoning import describe_sensitive_access_reasoning
from app.services.sensitive_access_types import SensitiveAccessRequestBundle

__all__ = [
    "build_sensitive_access_blocking_response",
    "serialize_sensitive_access_bundle",
]


def serialize_sensitive_access_bundle(bundle: SensitiveAccessRequestBundle) -> dict:
    approval_ticket = bundle.approval_ticket
    reasoning = describe_sensitive_access_reasoning(
        decision=bundle.access_request.decision,
        reason_code=bundle.access_request.reason_code,
    )
    return {
        "resource": {
            "id": bundle.resource.id,
            "label": bundle.resource.label,
            "description": bundle.resource.description,
            "sensitivity_level": bundle.resource.sensitivity_level,
            "source": bundle.resource.source,
            "metadata": bundle.resource.metadata_payload or {},
        },
        "access_request": {
            "id": bundle.access_request.id,
            "run_id": bundle.access_request.run_id,
            "node_run_id": bundle.access_request.node_run_id,
            "requester_type": bundle.access_request.requester_type,
            "requester_id": bundle.access_request.requester_id,
            "resource_id": bundle.access_request.resource_id,
            "action_type": bundle.access_request.action_type,
            "purpose_text": bundle.access_request.purpose_text,
            "decision": bundle.access_request.decision,
            "decision_label": reasoning.decision_label,
            "reason_code": bundle.access_request.reason_code,
            "reason_label": reasoning.reason_label,
            "policy_summary": reasoning.policy_summary,
        },
        "approval_ticket": (
            {
                "id": approval_ticket.id,
                "access_request_id": approval_ticket.access_request_id,
                "run_id": approval_ticket.run_id,
                "node_run_id": approval_ticket.node_run_id,
                "status": approval_ticket.status,
                "waiting_status": approval_ticket.waiting_status,
                "approved_by": approval_ticket.approved_by,
            }
            if approval_ticket is not None
            else None
        ),
        "notifications": [
            {
                "id": item.id,
                "approval_ticket_id": item.approval_ticket_id,
                "channel": item.channel,
                "target": item.target,
                "status": item.status,
            }
            for item in bundle.notifications
        ],
    }


def build_sensitive_access_blocking_response(
    bundle: SensitiveAccessRequestBundle | None,
    *,
    approval_detail: str,
    deny_detail: str,
) -> JSONResponse | None:
    if bundle is None or bundle.access_request.decision == "allow":
        return None

    payload = serialize_sensitive_access_bundle(bundle)
    if (
        bundle.access_request.decision == "require_approval"
        and bundle.approval_ticket is not None
        and bundle.approval_ticket.status == "pending"
    ):
        payload["detail"] = approval_detail
        return JSONResponse(status_code=status.HTTP_409_CONFLICT, content=payload)

    payload["detail"] = deny_detail
    return JSONResponse(status_code=status.HTTP_403_FORBIDDEN, content=payload)
