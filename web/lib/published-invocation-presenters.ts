export const PUBLISHED_INVOCATION_REASON_CODES = [
  "api_key_invalid",
  "api_key_required",
  "auth_mode_unsupported",
  "binding_inactive",
  "compiled_blueprint_missing",
  "protocol_mismatch",
  "rate_limit_exceeded",
  "rejected_other",
  "run_status_unsupported",
  "runtime_failed",
  "streaming_unsupported",
  "sync_waiting_unsupported",
  "target_version_missing",
  "unknown",
  "workflow_missing"
] as const;

export type PublishedInvocationReasonCode =
  (typeof PUBLISHED_INVOCATION_REASON_CODES)[number];

const REASON_LABELS: Record<string, string> = {
  api_key_invalid: "Invalid API key",
  api_key_required: "Missing API key",
  auth_mode_unsupported: "Unsupported auth mode",
  binding_inactive: "Inactive binding",
  compiled_blueprint_missing: "Missing blueprint",
  protocol_mismatch: "Protocol mismatch",
  rate_limit_exceeded: "Rate limit exceeded",
  rejected_other: "Rejected (other)",
  run_status_unsupported: "Unsupported run status",
  runtime_failed: "Runtime failed",
  streaming_unsupported: "Streaming not ready",
  sync_waiting_unsupported: "Sync waiting not supported",
  target_version_missing: "Missing workflow version",
  unknown: "Unknown issue",
  workflow_missing: "Workflow missing"
};

export function formatPublishedInvocationReasonLabel(
  reasonCode: string | null | undefined
) {
  if (!reasonCode) {
    return "No issue";
  }

  return REASON_LABELS[reasonCode] ?? reasonCode.replaceAll("_", " ");
}

export function formatRateLimitPressure(
  requests: number,
  used: number
) {
  if (requests <= 0) {
    return {
      percentage: 0,
      label: "0%"
    };
  }

  const percentage = Math.min(Math.round((used / requests) * 100), 100);
  return {
    percentage,
    label: `${percentage}%`
  };
}
