import { afterEach, describe, expect, it, vi } from "vitest";

import { fetchRunSnapshot } from "@/app/actions/run-snapshot";

type MockJsonResponse = {
  ok: boolean;
  json: () => Promise<unknown>;
};

function createJsonResponse(body: unknown, ok = true): MockJsonResponse {
  return {
    ok,
    json: async () => body
  };
}

describe("fetchRunSnapshot", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("合并 run detail 与 execution view，优先返回 backend execution focus", async () => {
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.endsWith("/api/runs/run-123")) {
        return createJsonResponse({
          status: "waiting",
          workflow_id: "workflow-1",
          current_node_id: "tool-a",
          node_runs: [
            {
              node_id: "tool-a",
              waiting_reason: "waiting approval"
            }
          ]
        });
      }

      if (url.endsWith("/api/runs/run-123/execution-view")) {
        return createJsonResponse({
          status: "waiting",
          workflow_id: "workflow-1",
          execution_focus_reason: "blocked_execution",
          execution_focus_node: {
            node_id: "tool-a",
            node_run_id: "node-run-1"
          },
          execution_focus_explanation: {
            primary_signal: "执行阻断：当前节点仍在等待审批。",
            follow_up: "下一步：优先回看审批时间线，而不是只看 waiting reason。"
          }
        });
      }

      throw new Error(`unexpected fetch url: ${url}`);
    });

    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchRunSnapshot("run-123")).resolves.toEqual({
      status: "waiting",
      workflowId: "workflow-1",
      currentNodeId: "tool-a",
      waitingReason: "waiting approval",
      executionFocusReason: "blocked_execution",
      executionFocusNodeId: "tool-a",
      executionFocusNodeRunId: "node-run-1",
      executionFocusExplanation: {
        primary_signal: "执行阻断：当前节点仍在等待审批。",
        follow_up: "下一步：优先回看审批时间线，而不是只看 waiting reason。"
      }
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("execution view 不可用时仍返回基础 run snapshot", async () => {
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.endsWith("/api/runs/run-456")) {
        return createJsonResponse({
          status: "running",
          workflow_id: "workflow-2",
          current_node_id: "tool-b",
          node_runs: [
            {
              node_id: "tool-b",
              waiting_reason: null
            }
          ]
        });
      }

      if (url.endsWith("/api/runs/run-456/execution-view")) {
        return createJsonResponse({ detail: "not found" }, false);
      }

      throw new Error(`unexpected fetch url: ${url}`);
    });

    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchRunSnapshot("run-456")).resolves.toEqual({
      status: "running",
      workflowId: "workflow-2",
      currentNodeId: "tool-b",
      waitingReason: null,
      executionFocusReason: null,
      executionFocusNodeId: null,
      executionFocusNodeRunId: null,
      executionFocusExplanation: null
    });
  });

  it("run detail 不可用时返回 null", async () => {
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.endsWith("/api/runs/missing-run")) {
        return createJsonResponse({ detail: "Run not found." }, false);
      }

      throw new Error(`unexpected fetch url: ${url}`);
    });

    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchRunSnapshot("missing-run")).resolves.toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
