import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { ExecutionNodeCallbackTicketList } from "@/components/run-diagnostics-execution/execution-node-card-sections";
import type { RunCallbackTicketItem } from "@/lib/get-run-views";

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: { children: ReactNode; href?: string } & Record<string, unknown>) =>
    createElement("a", { href: href ?? "#", ...props }, children)
}));

describe("ExecutionNodeCallbackTicketList", () => {
  it("reuses the shared operator inbox CTA surface for callback tickets", () => {
    const callbackTickets: RunCallbackTicketItem[] = [
      {
        ticket: "ticket-1",
        run_id: "run-1",
        node_run_id: "node-run-1",
        tool_call_id: "tool-call-1",
        tool_id: "callback.tool",
        tool_call_index: 0,
        waiting_status: "waiting_callback",
        status: "pending",
        reason: "awaiting callback",
        callback_payload: {
          trace_id: "trace-1"
        },
        created_at: "2026-03-22T01:00:00Z",
        expires_at: "2026-03-22T02:00:00Z",
        consumed_at: null,
        canceled_at: null,
        expired_at: null
      }
    ];

    const html = renderToStaticMarkup(
      createElement(ExecutionNodeCallbackTicketList, {
        callbackTickets
      })
    );

    expect(html).toContain("open inbox slice");
    expect(html).toContain("href=\"/sensitive-access?run_id=run-1&amp;node_run_id=node-run-1\"");
  });
});
