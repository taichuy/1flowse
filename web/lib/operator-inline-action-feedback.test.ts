import { describe, expect, it } from "vitest";

import {
  buildOperatorInlineActionFeedbackModel,
  hasStructuredOperatorInlineActionResult
} from "@/lib/operator-inline-action-feedback";

describe("operator inline action feedback", () => {
  it("builds a structured model from canonical explanations and snapshot evidence", () => {
    const model = buildOperatorInlineActionFeedbackModel({
      message: "审批已通过。",
      outcomeExplanation: {
        primary_signal: "审批已通过。",
        follow_up: "后端已把 waiting blocker 交回 runtime。"
      },
      runFollowUpExplanation: {
        primary_signal: "本次影响 1 个 run；整体状态分布：running 1。已回读 1 个样本。",
        follow_up: "run run-1：当前 run 状态：running。 当前节点：review。 重点信号：runtime 已继续推进。"
      },
      blockerDeltaSummary: "阻塞变化：已解除 approval pending。",
      runSnapshot: {
        status: "running",
        currentNodeId: "review",
        executionFocusNodeName: "Review",
        executionFocusArtifactCount: 1,
        executionFocusArtifactRefCount: 2,
        executionFocusToolCallCount: 3,
        executionFocusRawRefCount: 1,
        executionFocusExplanation: {
          primary_signal: "runtime 已继续推进。",
          follow_up: "继续观察后续节点。"
        }
      }
    });

    expect(model.hasStructuredContent).toBe(true);
    expect(model.headline).toBe("审批已通过。");
    expect(model.outcomeFollowUp).toBe("后端已把 waiting blocker 交回 runtime。");
    expect(model.runFollowUpPrimarySignal).toContain("本次影响 1 个 run");
    expect(model.runFollowUpFollowUp).toContain("run run-1");
    expect(model.blockerDeltaSummary).toBe("阻塞变化：已解除 approval pending。");
    expect(model.runStatus).toBe("running");
    expect(model.currentNodeId).toBe("review");
    expect(model.focusNodeLabel).toBe("Review");
    expect(model.artifactCount).toBe(1);
    expect(model.artifactRefCount).toBe(2);
    expect(model.toolCallCount).toBe(3);
    expect(model.rawRefCount).toBe(1);
  });

  it("detects when only plain text exists without structured follow-up", () => {
    expect(
      hasStructuredOperatorInlineActionResult({
        outcomeExplanation: null,
        runFollowUpExplanation: null,
        blockerDeltaSummary: null,
        runSnapshot: null
      })
    ).toBe(false);
  });
});
