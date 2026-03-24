from __future__ import annotations

from typing import Any

from app.models.sensitive_access import SensitiveResourceRecord
from app.schemas.credential_governance import CredentialGovernanceSummary
from app.schemas.sensitive_access import SensitiveResourceItem

_VALID_CREDENTIAL_STATUSES = {"active", "revoked"}


def build_credential_governance_summary_from_sensitive_resource(
    resource: SensitiveResourceRecord,
) -> CredentialGovernanceSummary | None:
    if resource.source != "credential":
        return None

    metadata = resource.metadata_payload if isinstance(resource.metadata_payload, dict) else {}
    credential_id = _normalize_metadata_value(metadata, "credential_id")
    credential_name = _normalize_metadata_value(metadata, "credential_name")
    credential_type = _normalize_metadata_value(metadata, "credential_type")
    credential_ref = _normalize_metadata_value(metadata, "credential_ref")
    credential_status = _normalize_credential_status(
        _normalize_metadata_value(metadata, "credential_status")
    )

    if not all((credential_id, credential_name, credential_type, credential_ref)):
        return None

    return CredentialGovernanceSummary(
        credential_id=credential_id,
        credential_name=credential_name,
        credential_type=credential_type,
        credential_status=credential_status,
        sensitivity_level=resource.sensitivity_level,
        sensitive_resource_id=resource.id,
        sensitive_resource_label=resource.label,
        credential_ref=credential_ref,
        summary=_build_credential_governance_summary(
            credential_name=credential_name,
            credential_type=credential_type,
            sensitivity_level=resource.sensitivity_level,
            credential_status=credential_status,
        ),
    )


def format_credential_governance_status_label(status: str | None) -> str:
    return "生效中" if status == "active" else "已吊销"


def format_credential_governance_compact_summary(
    summary: CredentialGovernanceSummary | None,
) -> str | None:
    if summary is None:
        return None
    return (
        f"{summary.credential_name} · {summary.sensitivity_level} 治理 · "
        f"{format_credential_governance_status_label(summary.credential_status)}"
    )


def format_sensitive_resource_governance_summary(
    resource: SensitiveResourceItem | None,
) -> str | None:
    if resource is None:
        return None

    resource_label = str(resource.label or "").strip() or None
    governance_summary = format_credential_governance_compact_summary(
        resource.credential_governance
    )
    if governance_summary is None:
        return resource_label
    credential_name = (
        str(resource.credential_governance.credential_name or "").strip()
        if resource.credential_governance is not None
        else ""
    )
    if resource_label and (
        governance_summary == resource_label
        or governance_summary.startswith(f"{resource_label} · ")
    ):
        return governance_summary
    if (
        resource_label
        and credential_name
        and resource_label.endswith(credential_name)
        and governance_summary.startswith(f"{credential_name} · ")
    ):
        return f"{resource_label}{governance_summary[len(credential_name):]}"
    return " · ".join(
        item for item in (resource_label, governance_summary) if item is not None
    )


def _normalize_metadata_value(metadata: dict[str, Any], key: str) -> str:
    return str(metadata.get(key) or "").strip()


def _normalize_credential_status(status: str) -> str:
    normalized = status.strip().lower()
    if normalized in _VALID_CREDENTIAL_STATUSES:
        return normalized
    return "active"


def _build_credential_governance_summary(
    *,
    credential_name: str,
    credential_type: str,
    sensitivity_level: str,
    credential_status: str,
) -> str:
    status_label = format_credential_governance_status_label(credential_status)
    return (
        f"本次命中的凭据是 {credential_name}（{credential_type}）；"
        f"当前治理级别 {sensitivity_level}，状态 {status_label}。"
    )
