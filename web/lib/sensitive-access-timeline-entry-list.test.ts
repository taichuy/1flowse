import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { SensitiveAccessTimelineEntryList } from "@/components/sensitive-access-timeline-entry-list";
import type { SensitiveAccessTimelineEntry } from "@/lib/get-sensitive-access";

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: { children: unknown; href?: string } & Record<string, unknown>) =>
    createElement("a", { href: href ?? "#", ...props }, children)
}));

vi.mock("@/components/sensitive-access-inline-actions", () => ({
  SensitiveAccessInlineActions: () => createElement("div", { "data-testid": "sensitive-access-inline-actions" })
}));

function buildTimelineEntry(
  overrides: Partial<SensitiveAccessTimelineEntry> = {}
): SensitiveAccessTimelineEntry {
  return {
    request: {
      id: "request-1",
      run_id: "run-1",
      node_run_id: "node-run-1",
      requester_type: "workflow",
      requester_id: "requester-1",
      resource_id: "resource-1",
      action_type: "invoke",
      purpose_text: "读取敏感配置",
      decision: "require_approval",
      decision_label: "require approval",
      reason_code: "sensitive_access_requires_approval",
      reason_label: "需要审批",
      policy_summary: "L3 资源默认要求人工审批。",
      created_at: "2026-03-19T00:00:00Z",
      decided_at: null
    },
    resource: {
      id: "resource-1",
      label: "Search Tool",
      description: "high-risk tool",
      sensitivity_level: "L3",
      source: "local_capability",
      metadata: {},
      created_at: "2026-03-19T00:00:00Z",
      updated_at: "2026-03-19T00:00:00Z"
    },
    approval_ticket: {
      id: "ticket-1",
      access_request_id: "request-1",
      run_id: "run-1",
      node_run_id: "node-run-1",
      status: "pending",
      waiting_status: "waiting",
      approved_by: null,
      decided_at: null,
      expires_at: "2026-03-20T00:00:00Z",
      created_at: "2026-03-19T00:00:00Z"
    },
    notifications: [
      {
        id: "notification-1",
        approval_ticket_id: "ticket-1",
        channel: "email",
        target: "owner@example.com",
        status: "failed",
        delivered_at: null,
        error: "smtp timeout",
        created_at: "2026-03-19T00:05:00Z"
      }
    ],
    outcome_explanation: {
      primary_signal: "敏感访问请求仍在等待审批，对应 waiting 链路会继续保持 blocked。",
      follow_up: "最近 1 条通知投递失败，请优先重试通知或更换目标。 审批完成后再继续回看 run / inbox slice。"
    },
    ...overrides
  };
}

describe("SensitiveAccessTimelineEntryList", () => {
  it("为待审批或通知失败的 entry 渲染共享 callback waiting 摘要", () => {
    const markup = renderToStaticMarkup(
      createElement(SensitiveAccessTimelineEntryList, {
        entries: [buildTimelineEntry()],
        emptyCopy: "empty",
        defaultRunId: "run-1"
      })
    );

    expect(markup).toContain("approval pending");
    expect(markup).toContain("notify failed 1");
    expect(markup).toContain(
      "Sensitive access: Search Tool · require approval · 需要审批 · L3 资源默认要求人工审批。"
    );
    expect(markup).toContain("Notification: latest notify email failed · owner@example.com · smtp timeout");
    expect(markup).toContain("open inbox slice");
  });

  it("不会为已经完成且无需 follow-up 的 entry 重复渲染 callback waiting 摘要", () => {
    const markup = renderToStaticMarkup(
      createElement(SensitiveAccessTimelineEntryList, {
        entries: [
          buildTimelineEntry({
            request: {
              ...buildTimelineEntry().request,
              decision: "allow",
              decision_label: "allow",
              reason_code: "sensitive_access_allowed",
              reason_label: "允许",
              policy_summary: "允许当前读取。",
              decided_at: "2026-03-19T00:10:00Z"
            },
            approval_ticket: {
              ...buildTimelineEntry().approval_ticket,
              status: "approved",
              waiting_status: "resumed",
              approved_by: "operator-1",
              decided_at: "2026-03-19T00:10:00Z"
            },
            notifications: [
              {
                id: "notification-2",
                approval_ticket_id: "ticket-1",
                channel: "email",
                target: "owner@example.com",
                status: "delivered",
                delivered_at: "2026-03-19T00:08:00Z",
                error: null,
                created_at: "2026-03-19T00:05:00Z"
              }
            ],
            outcome_explanation: {
              primary_signal: "审批已通过，对应 waiting blocker 已交回 runtime。",
              follow_up: "继续观察 run 是否真正恢复。"
            }
          })
        ],
        emptyCopy: "empty",
        defaultRunId: "run-1"
      })
    );

    expect(markup).not.toContain("approval pending");
    expect(markup).not.toContain("notify failed 1");
    expect(markup).not.toContain("Sensitive access:");
    expect(markup).not.toContain("Notification:");
  });
});
