import type { RunCallbackTicketItem } from "@/lib/get-run-views";
import { buildSensitiveAccessInboxHref } from "@/lib/sensitive-access-links";

type CallbackTicketInboxHrefOptions = {
  runId?: string | null;
  nodeRunId?: string | null;
};

export function buildCallbackTicketInboxHref(
  ticket: Pick<RunCallbackTicketItem, "run_id" | "node_run_id">,
  options: CallbackTicketInboxHrefOptions = {}
) {
  const runId = options.runId ?? ticket.run_id ?? null;
  const nodeRunId = options.nodeRunId ?? ticket.node_run_id ?? null;

  if (!runId && !nodeRunId) {
    return null;
  }

  return buildSensitiveAccessInboxHref({
    runId,
    nodeRunId
  });
}
