import {
  fetchCallbackBlockerSnapshot,
  formatCallbackAutomationHealthDeltaSummary,
  type CallbackBlockerSnapshot
} from "@/lib/callback-blocker-follow-up";
import { formatPrimaryGovernedResourceChineseDetail } from "@/lib/credential-governance";
import type { SensitiveResourceItem } from "@/lib/get-sensitive-access";
import { getSystemOverview } from "@/lib/get-system-overview";

type CallbackBlockerScope = {
  runId?: string | null;
  nodeRunId?: string | null;
};

export async function fetchScopedCallbackBlockerSnapshot({
  runId,
  nodeRunId
}: CallbackBlockerScope): Promise<CallbackBlockerSnapshot | null> {
  const normalizedRunId = runId?.trim();
  if (!normalizedRunId) {
    return null;
  }

  const callbackWaitingAutomation = (await getSystemOverview()).callback_waiting_automation;
  return fetchCallbackBlockerSnapshot({
    runId: normalizedRunId,
    nodeRunId: nodeRunId?.trim() || null,
    callbackWaitingAutomation
  });
}

export function joinUniqueMessageParts(parts: Array<string | null | undefined>) {
  const normalized: string[] = [];
  for (const part of parts) {
    const trimmed = part?.trim();
    if (!trimmed || normalized.includes(trimmed)) {
      continue;
    }
    normalized.push(trimmed);
  }
  return normalized.join(" ");
}

export function buildActionCallbackBlockerDeltaSummary({
  backendSummary,
  backendPrimaryResource,
  before,
  after
}: {
  backendSummary?: string | null;
  backendPrimaryResource?: SensitiveResourceItem | null;
  before?: CallbackBlockerSnapshot | null;
  after?: CallbackBlockerSnapshot | null;
}) {
  return (
    joinUniqueMessageParts([
      backendSummary,
      formatPrimaryGovernedResourceChineseDetail(
        backendPrimaryResource ?? after?.primaryResource ?? before?.primaryResource ?? null
      ),
      formatCallbackAutomationHealthDeltaSummary({ before, after })
    ]) || null
  );
}
