import { describe, expect, it } from "vitest";

import {
  buildWorkflowPersistBlockers,
  formatWorkflowPersistBlockedMessage,
  summarizeWorkflowPersistBlockers
} from "@/components/workflow-editor-workbench/persist-blockers";

describe("workflow persist blockers", () => {
  it("builds a canonical save gate summary and blocked message", () => {
    const blockers = buildWorkflowPersistBlockers({
      unsupportedNodeCount: 1,
      unsupportedNodeSummary: "Loop x1",
      toolExecutionValidationSummary:
        "Tool 节点请求 sandbox execution，但当前 capability 还没有暴露 dependencyRef 支持",
      sandboxReadinessPreflightHint:
        "当前 sandbox readiness：当前没有启用 sandbox backend；sandbox / microvm 等强隔离 execution class 会 fail-closed。",
      publishDraftValidationSummary: "publish.0.path 重复"
    });

    expect(blockers.map((blocker) => blocker.label)).toEqual([
      "Unsupported nodes",
      "Execution capability",
      "Publish draft"
    ]);
    expect(summarizeWorkflowPersistBlockers(blockers)).toBe(
      "当前保存会被 3 类问题阻断：Unsupported nodes / Execution capability / Publish draft。"
    );
    expect(formatWorkflowPersistBlockedMessage(blockers)).toContain("Loop x1");
    expect(formatWorkflowPersistBlockedMessage(blockers)).toContain("sandbox backend");
    expect(formatWorkflowPersistBlockedMessage(blockers)).toContain("publish.0.path 重复");
  });
});
