import { describe, expect, it } from "vitest";

import {
  readWorkflowLogsRequestedRunId,
  selectWorkflowLogsInvocation,
  selectWorkflowLogsRun
} from "@/lib/workflow-logs-surface";

function buildInvocationAudit(itemIds: string[]) {
  return {
    items: itemIds.map((id) => ({ id }))
  } as never;
}

describe("workflow-logs-surface helpers", () => {
  it("reads the first run query value and trims whitespace", () => {
    expect(readWorkflowLogsRequestedRunId([" run-1 ", "ignored"])) .toBe("run-1");
    expect(readWorkflowLogsRequestedRunId(undefined)).toBeNull();
  });

  it("defaults to the first binding with invocation facts and its latest invocation", () => {
    expect(
      selectWorkflowLogsInvocation(
        [{ id: "binding-empty" }, { id: "binding-1" }],
        {
          "binding-empty": buildInvocationAudit([]),
          "binding-1": buildInvocationAudit(["invocation-2", "invocation-1"])
        },
        null,
        null
      )
    ).toEqual({
      activeBindingId: "binding-1",
      selectedInvocationId: "invocation-2",
      selectionSource: "latest",
      selectionNotice: null
    });
  });

  it("resolves a requested invocation across bindings when binding is omitted", () => {
    expect(
      selectWorkflowLogsInvocation(
        [{ id: "binding-1" }, { id: "binding-2" }],
        {
          "binding-1": buildInvocationAudit(["invocation-2"]),
          "binding-2": buildInvocationAudit(["invocation-9"])
        },
        null,
        "invocation-9"
      )
    ).toEqual({
      activeBindingId: "binding-2",
      selectedInvocationId: "invocation-9",
      selectionSource: "query",
      selectionNotice: null
    });
  });

  it("falls back to the latest invocation with an honest notice when the requested invocation is missing", () => {
    expect(
      selectWorkflowLogsInvocation(
        [{ id: "binding-1" }],
        {
          "binding-1": buildInvocationAudit(["invocation-2", "invocation-1"])
        },
        "binding-1",
        "missing"
      )
    ).toEqual({
      activeBindingId: "binding-1",
      selectedInvocationId: "invocation-2",
      selectionSource: "fallback",
      selectionNotice:
        "请求的 invocation 不在当前 binding 的 recent invocation 列表中，页面已回退到该 binding 的最新一条记录，避免误读跨 binding 日志事实。"
    });
  });

  it("keeps run fallback selection behavior for recent runs", () => {
    expect(
      selectWorkflowLogsRun(
        [{ id: "run-2" }, { id: "run-1" }] as never,
        "run-1"
      )
    ).toMatchObject({
      activeRun: { id: "run-1" },
      selectionSource: "query",
      selectionNotice: null
    });
  });
});
