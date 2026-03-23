import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { WorkflowPublishLifecycleForm } from "@/components/workflow-publish-lifecycle-form";
import type { UpdatePublishedEndpointLifecycleState } from "@/app/actions/publish";

type MockActionState = Record<string, unknown>;

let actionStateQueue: MockActionState[] = [];

vi.mock("react", async () => {
  const actual = await vi.importActual<typeof import("react")>("react");
  return {
    ...actual,
    useActionState: () => [actionStateQueue.shift() ?? { status: "idle", message: "" }, vi.fn()]
  };
});

vi.mock("react-dom", async () => {
  const actual = await vi.importActual<typeof import("react-dom")>("react-dom");
  return {
    ...actual,
    useFormStatus: () => ({ pending: false })
  };
});

describe("WorkflowPublishLifecycleForm", () => {
  beforeEach(() => {
    actionStateQueue = [];
  });

  it("disables publish action when binding still has a blocking legacy auth issue", () => {
    const html = renderToStaticMarkup(
      createElement(WorkflowPublishLifecycleForm, {
        workflowId: "workflow-1",
        bindingId: "binding-1",
        currentStatus: "draft",
        issues: [
          {
            category: "unsupported_auth_mode",
            message: "Legacy token auth is still persisted on this binding.",
            remediation: "Switch back to api_key or internal before publishing.",
            blocks_lifecycle_publish: true
          }
        ],
        action: async (state: UpdatePublishedEndpointLifecycleState) => state
      })
    );

    expect(html).toContain("Legacy token auth is still persisted on this binding.");
    expect(html).toContain("Switch back to api_key or internal before publishing.");
    expect(html).toContain("发布 endpoint");
    expect(html).toContain('<button class="sync-button" type="submit" disabled="">');
  });

  it("keeps offline action available even if the binding reports legacy auth issues", () => {
    const html = renderToStaticMarkup(
      createElement(WorkflowPublishLifecycleForm, {
        workflowId: "workflow-1",
        bindingId: "binding-1",
        currentStatus: "published",
        issues: [
          {
            category: "unsupported_auth_mode",
            message: "Legacy token auth is still persisted on this binding.",
            remediation: "Switch back to api_key or internal before publishing.",
            blocks_lifecycle_publish: true
          }
        ],
        action: async (state: UpdatePublishedEndpointLifecycleState) => state
      })
    );

    expect(html).toContain("下线 endpoint");
    expect(html).toContain('<button class="sync-button" type="submit">');
  });
});
