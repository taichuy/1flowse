import { describe, expect, it } from "vitest";

import type { WorkflowPublishInvocationActiveFilter } from "@/lib/workflow-publish-governance";

import { buildWorkflowPublishActivityHref } from "@/components/workflow-publish-activity-panel-helpers";

describe("workflow publish activity panel helpers", () => {
  it("keeps publish activity self-links on the shared workflow editor contract", () => {
    const activeInvocationFilter = {
      bindingId: "binding-1",
      status: "failed",
      requestSource: "path",
      requestSurface: "openai.responses",
      cacheStatus: "hit",
      runStatus: " waiting_callback ",
      apiKeyId: " api key/1 ",
      reasonCode: "rate_limit_exceeded",
      timeWindow: "24h"
    } satisfies WorkflowPublishInvocationActiveFilter;

    expect(
      buildWorkflowPublishActivityHref({
        workflowId: " workflow alpha/beta ",
        bindingId: " binding alpha/beta ",
        activeInvocationFilter,
        invocationId: " invocation alpha/beta "
      })
    ).toBe(
      "/workflows/workflow%20alpha%2Fbeta?publish_binding=binding+alpha%2Fbeta&publish_status=failed&publish_request_source=path&publish_request_surface=openai.responses&publish_cache_status=hit&publish_run_status=waiting_callback&publish_api_key_id=api+key%2F1&publish_reason_code=rate_limit_exceeded&publish_window=24h&publish_invocation=invocation+alpha%2Fbeta"
    );
  });

  it("drops empty publish scope values and falls back to the canonical workflow href", () => {
    expect(
      buildWorkflowPublishActivityHref({
        workflowId: " workflow-1 ",
        bindingId: "   ",
        activeInvocationFilter: {
          bindingId: null,
          status: null,
          requestSource: null,
          requestSurface: null,
          cacheStatus: null,
          runStatus: "   ",
          apiKeyId: "",
          reasonCode: " ",
          timeWindow: "all"
        },
        invocationId: "   "
      })
    ).toBe("/workflows/workflow-1");
  });
});
