import { beforeEach, describe, expect, it, vi } from "vitest";

import { updatePublishedEndpointLifecycle } from "@/app/actions/publish";

const { revalidatePath } = vi.hoisted(() => ({
  revalidatePath: vi.fn()
}));

vi.mock("next/cache", () => ({
  revalidatePath
}));

vi.mock("@/lib/api-base-url", () => ({
  getApiBaseUrl: () => "http://api.test"
}));

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json"
    }
  });
}

function buildLifecycleFormData(nextStatus: "published" | "offline") {
  const formData = new FormData();
  formData.set("workflowId", "wf-1");
  formData.set("bindingId", "binding-1");
  formData.set("nextStatus", nextStatus);
  return formData;
}

describe("workflow publish actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", vi.fn());
  });

  it("uses shared lifecycle success feedback for publish transitions", async () => {
    vi.mocked(global.fetch).mockResolvedValue(
      jsonResponse({
        endpoint_name: "Public Search",
        lifecycle_status: "published"
      })
    );

    const result = await updatePublishedEndpointLifecycle(
      {
        status: "idle",
        message: "",
        workflowId: "wf-1",
        bindingId: "binding-1",
        nextStatus: "published"
      },
      buildLifecycleFormData("published")
    );

    expect(result).toEqual({
      status: "success",
      message: "Public Search 已发布。",
      workflowId: "wf-1",
      bindingId: "binding-1",
      nextStatus: "published"
    });
    expect(global.fetch).toHaveBeenCalledWith(
      "http://api.test/api/workflows/wf-1/published-endpoints/binding-1/lifecycle",
      expect.objectContaining({
        method: "PATCH",
        cache: "no-store"
      })
    );
    expect(revalidatePath).toHaveBeenCalledWith("/workflows/wf-1");
  });

  it("uses shared lifecycle fallback error feedback for offline transitions", async () => {
    vi.mocked(global.fetch).mockResolvedValue(jsonResponse({}, 500));

    const result = await updatePublishedEndpointLifecycle(
      {
        status: "idle",
        message: "",
        workflowId: "wf-1",
        bindingId: "binding-1",
        nextStatus: "offline"
      },
      buildLifecycleFormData("offline")
    );

    expect(result).toEqual({
      status: "error",
      message: "下线 endpoint 失败。",
      workflowId: "wf-1",
      bindingId: "binding-1",
      nextStatus: "offline"
    });
  });

  it("uses shared lifecycle network feedback when the backend is unreachable", async () => {
    vi.mocked(global.fetch).mockRejectedValue(new Error("network down"));

    const result = await updatePublishedEndpointLifecycle(
      {
        status: "idle",
        message: "",
        workflowId: "wf-1",
        bindingId: "binding-1",
        nextStatus: "offline"
      },
      buildLifecycleFormData("offline")
    );

    expect(result).toEqual({
      status: "error",
      message: "无法连接后端下线 endpoint，请确认 API 已启动。",
      workflowId: "wf-1",
      bindingId: "binding-1",
      nextStatus: "offline"
    });
  });

  it("uses shared lifecycle validation feedback when binding fields are missing", async () => {
    const formData = new FormData();
    formData.set("workflowId", "wf-1");

    const result = await updatePublishedEndpointLifecycle(
      {
        status: "idle",
        message: "",
        workflowId: "",
        bindingId: "",
        nextStatus: "published"
      },
      formData
    );

    expect(result).toEqual({
      status: "error",
      message: "缺少发布 binding 信息，无法更新发布状态。",
      workflowId: "wf-1",
      bindingId: "",
      nextStatus: "published"
    });
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
