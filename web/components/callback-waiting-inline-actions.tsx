"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";

import {
  cleanupRunCallbackTickets,
  type CleanupRunCallbackTicketsState
} from "@/app/actions/callback-tickets";

type CallbackWaitingInlineActionsProps = {
  runId: string | null;
  nodeRunId?: string | null;
  compact?: boolean;
};

const initialState: CleanupRunCallbackTicketsState = {
  status: "idle",
  message: "",
  scopeKey: ""
};

export function CallbackWaitingInlineActions({
  runId,
  nodeRunId = null,
  compact = false
}: CallbackWaitingInlineActionsProps) {
  const router = useRouter();
  const [state, action] = useActionState(cleanupRunCallbackTickets, initialState);
  const scopeKey = `${runId ?? ""}:${nodeRunId ?? ""}`;

  useEffect(() => {
    if (state.status === "success") {
      router.refresh();
    }
  }, [router, state.status]);

  if (!runId) {
    return null;
  }

  return (
    <div className={compact ? "entry-card compact-card" : undefined}>
      {compact ? <p className="entry-card-title">Callback actions</p> : null}
      <form action={action} className="inbox-decision-form">
        <input type="hidden" name="runId" value={runId} />
        <input type="hidden" name="nodeRunId" value={nodeRunId ?? ""} />
        <div className="binding-actions">
          <button className="action-link-button" type="submit">
            处理过期 ticket 并尝试恢复
          </button>
        </div>
        <p className="empty-state compact">
          仅处理当前 run / node slice 下已过期的 callback ticket，不会扫全局批次。
        </p>
        {state.message && state.scopeKey === scopeKey ? (
          <p className={`sync-message ${state.status}`}>{state.message}</p>
        ) : null}
      </form>
    </div>
  );
}
