import type {
  SensitiveAccessBlockingPayload,
  SensitiveAccessBlockingRequest
} from "@/lib/sensitive-access";
import type { SensitiveAccessRequestItem } from "@/lib/get-sensitive-access";

const DECISION_LABELS: Record<string, string> = {
  allow: "allowed",
  allow_masked: "allowed with masking",
  deny: "denied",
  require_approval: "approval required"
};

const REASON_LABELS: Record<string, string> = {
  allow_low_sensitivity: "low-sensitivity access allowed",
  allow_standard_low_risk: "low-risk access allowed",
  allow_human_moderate_runtime_use: "human moderate-sensitivity runtime access allowed",
  masked_moderate_runtime_use: "moderate-sensitivity runtime access masked",
  approval_required_non_human_mutation: "non-human mutation requires approval",
  approval_required_moderate_sensitive_operation: "moderate-sensitivity operation requires approval",
  deny_non_human_high_sensitive_mutation: "non-human high-sensitivity mutation denied",
  approval_required_high_sensitive_access: "high-sensitivity access requires approval",
  approved_after_review: "approved after review",
  rejected_after_review: "rejected after review",
  access_denied: "access denied"
};

type RequestLike = Pick<
  SensitiveAccessRequestItem,
  "decision" | "decision_label" | "reason_code" | "reason_label" | "policy_summary"
>;

type BlockingRequestLike = Pick<
  SensitiveAccessBlockingRequest,
  "decision" | "decision_label" | "reason_code" | "reason_label" | "policy_summary"
>;

function formatFallbackLabel(value: string | null | undefined): string | null {
  if (!value?.trim()) {
    return null;
  }

  return value
    .trim()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

export function formatSensitiveAccessDecisionLabel(request: RequestLike | BlockingRequestLike): string {
  return (
    request.decision_label ??
    (request.decision ? DECISION_LABELS[request.decision] : null) ??
    formatFallbackLabel(request.decision) ??
    "pending"
  );
}

export function formatSensitiveAccessReasonLabel(request: RequestLike | BlockingRequestLike): string | null {
  return (
    request.reason_label ??
    (request.reason_code ? REASON_LABELS[request.reason_code] : null) ??
    formatFallbackLabel(request.reason_code)
  );
}

export function getSensitiveAccessPolicySummary(
  request: RequestLike | BlockingRequestLike
): string | null {
  return request.policy_summary ?? null;
}

export function getSensitiveAccessBlockedPolicySummary(
  payload: SensitiveAccessBlockingPayload
): string | null {
  return getSensitiveAccessPolicySummary(payload.access_request);
}
