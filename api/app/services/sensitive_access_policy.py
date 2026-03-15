from __future__ import annotations

from app.services.sensitive_access_types import AccessDecisionResult


def evaluate_default_sensitive_access_policy(
    *,
    sensitivity_level: str,
    requester_type: str,
    action_type: str,
) -> AccessDecisionResult:
    if sensitivity_level == "L0":
        return AccessDecisionResult("allow", "allow_low_sensitivity")

    if sensitivity_level == "L1":
        if requester_type != "human" and action_type in {"export", "write"}:
            return AccessDecisionResult(
                "require_approval",
                "approval_required_non_human_mutation",
            )
        return AccessDecisionResult("allow", "allow_standard_low_risk")

    if sensitivity_level == "L2":
        if requester_type == "human" and action_type in {"read", "use", "invoke"}:
            return AccessDecisionResult(
                "allow",
                "allow_human_moderate_runtime_use",
            )
        if action_type in {"read", "use", "invoke"}:
            return AccessDecisionResult(
                "allow_masked",
                "masked_moderate_runtime_use",
            )
        return AccessDecisionResult(
            "require_approval",
            "approval_required_moderate_sensitive_operation",
        )

    if requester_type != "human" and action_type in {"export", "write"}:
        return AccessDecisionResult(
            "deny",
            "deny_non_human_high_sensitive_mutation",
        )
    return AccessDecisionResult(
        "require_approval",
        "approval_required_high_sensitive_access",
    )
