import { beforeEach, describe, expect, it, vi } from "vitest";

import { triggerWorkflowNodeTrialRun, triggerWorkflowRun } from "@/app/actions/runs";
import { revalidateOperatorFollowUpPaths } from "@/app/actions/operator-follow-up-revalidation";
import {
  ACCESS_TOKEN_COOKIE_NAME,
  CSRF_TOKEN_COOKIE_NAME,
  CSRF_TOKEN_HEADER_NAME
} from "@/lib/workspace-access";

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    getAll: () => [
      { name: "sevenflows_access_token", value: "access-token-demo" },
      { name: "sevenflows_csrf_token", value: "csrf-token-demo" }
    ],
    get: (name: string) => {
      if (name === "sevenflows_access_token") {
        return { value: "access-token-demo" };
      }
      if (name === "sevenflows_csrf_token") {
        return { value: "csrf-token-demo" };
      }
      return undefined;
    }
  }))
}));

vi.mock("@/lib/api-base-url", () => ({
  getApiBaseUrl: () => "http://api.test"
}));

vi.mock("@/app/actions/operator-follow-up-revalidation", () => ({
  revalidateOperatorFollowUpPaths: vi.fn()
}));

function jsonResponse(body: unknown, ok = true) {
  return new Response(JSON.stringify(body), {
    status: ok ? 200 : 500,
    headers: {
      "Content-Type": "application/json"
    }
  });
}

describe("run trigger actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", vi.fn());
  });

  it("forwards workspace auth cookies and csrf when triggering a workflow run", async () => {
    vi.mocked(global.fetch).mockResolvedValue(jsonResponse({ id: "run-1" }));

    const result = await triggerWorkflowRun("wf-1", { query: "hello" });

    expect(result).toMatchObject({ status: "success", runId: "run-1" });
    expect(revalidateOperatorFollowUpPaths).toHaveBeenCalledWith({
      workflowIds: ["wf-1"],
      runIds: ["run-1"]
    });
    expect(vi.mocked(global.fetch).mock.calls[0]?.[0]).toBe("http://api.test/api/workflows/wf-1/runs");
    const headers = (vi.mocked(global.fetch).mock.calls[0]?.[1] as RequestInit).headers as Headers;
    expect(headers.get("Authorization")).toBe("Bearer access-token-demo");
    expect(headers.get(CSRF_TOKEN_HEADER_NAME)).toBe("csrf-token-demo");
    expect(headers.get("Cookie")).toContain(`${ACCESS_TOKEN_COOKIE_NAME}=access-token-demo`);
  });

  it("forwards workspace auth cookies and csrf when triggering a node trial run", async () => {
    vi.mocked(global.fetch).mockResolvedValue(jsonResponse({ id: "run-node-1" }));

    const result = await triggerWorkflowNodeTrialRun("wf-1", "node-1", { query: "hello" });

    expect(result).toMatchObject({ status: "success", runId: "run-node-1" });
    expect(revalidateOperatorFollowUpPaths).toHaveBeenCalledWith({
      runIds: ["run-node-1"]
    });
    expect(vi.mocked(global.fetch).mock.calls[0]?.[0]).toBe(
      "http://api.test/api/workflows/wf-1/nodes/node-1/trial-runs"
    );
    const headers = (vi.mocked(global.fetch).mock.calls[0]?.[1] as RequestInit).headers as Headers;
    expect(headers.get("Authorization")).toBe("Bearer access-token-demo");
    expect(headers.get(CSRF_TOKEN_HEADER_NAME)).toBe("csrf-token-demo");
    expect(headers.get("Cookie")).toContain(`${ACCESS_TOKEN_COOKIE_NAME}=access-token-demo`);
  });
});
