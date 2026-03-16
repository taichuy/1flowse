from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class SensitiveAccessReasoning:
    decision_label: str
    reason_label: str | None
    policy_summary: str | None


_DECISION_LABELS: dict[str, str] = {
    "allow": "Allowed",
    "deny": "Denied",
    "require_approval": "Approval required",
    "allow_masked": "Allowed with masking",
}

_REASON_LABELS: dict[str, str] = {
    "allow_low_sensitivity": "Low-sensitivity access allowed",
    "allow_standard_low_risk": "Low-risk access allowed",
    "allow_human_moderate_runtime_use": "Human moderate-sensitivity runtime access allowed",
    "masked_moderate_runtime_use": "Moderate-sensitivity runtime access masked",
    "approval_required_non_human_mutation": "Non-human mutation requires approval",
    "approval_required_moderate_sensitive_operation": "Moderate-sensitivity operation requires approval",
    "deny_non_human_high_sensitive_mutation": "Non-human high-sensitivity mutation denied",
    "approval_required_high_sensitive_access": "High-sensitivity access requires approval",
    "approved_after_review": "Access approved after review",
    "rejected_after_review": "Access rejected after review",
    "access_denied": "Access denied",
}

_POLICY_SUMMARIES: dict[str, str] = {
    "allow_low_sensitivity": "Default policy allows low-sensitivity resources without extra review.",
    "allow_standard_low_risk": "Default policy allows this low-risk access pattern without operator review.",
    "allow_human_moderate_runtime_use": "Human read/use/invoke access to moderate-sensitivity resources is allowed by default policy.",
    "masked_moderate_runtime_use": "Non-human read/use/invoke access to moderate-sensitivity resources is only allowed in masked form.",
    "approval_required_non_human_mutation": "Non-human export or write operations require operator approval before execution can continue.",
    "approval_required_moderate_sensitive_operation": "This moderate-sensitivity operation crosses the default review threshold and must be approved.",
    "deny_non_human_high_sensitive_mutation": "Default policy blocks non-human export or write operations against high-sensitivity resources.",
    "approval_required_high_sensitive_access": "High-sensitivity access must be reviewed by an operator before the workflow can resume.",
    "approved_after_review": "An operator approved the request and the blocked workflow can resume.",
    "rejected_after_review": "An operator rejected the request, so the blocked workflow remains denied.",
    "access_denied": "Access is denied by the current sensitive-access policy.",
}


def describe_sensitive_access_reasoning(
    *,
    decision: str | None,
    reason_code: str | None,
) -> SensitiveAccessReasoning:
    normalized_decision = str(decision or "").strip()
    normalized_reason = str(reason_code or "").strip()
    return SensitiveAccessReasoning(
        decision_label=_DECISION_LABELS.get(normalized_decision, normalized_decision or "Pending"),
        reason_label=_REASON_LABELS.get(normalized_reason) if normalized_reason else None,
        policy_summary=_POLICY_SUMMARIES.get(normalized_reason) if normalized_reason else None,
    )
