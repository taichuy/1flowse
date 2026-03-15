import type {
  PublishedEndpointInvocationCacheStatus,
  PublishedEndpointInvocationRequestSource,
  PublishedEndpointInvocationRequestSurface,
  PublishedEndpointInvocationStatus
} from "@/lib/get-workflow-publish";

export type PublishTimeWindow = "24h" | "7d" | "30d" | "all";

export type WorkflowPublishInvocationActiveFilter = {
  bindingId: string | null;
  status: PublishedEndpointInvocationStatus | null;
  requestSource: PublishedEndpointInvocationRequestSource | null;
  requestSurface: PublishedEndpointInvocationRequestSurface | null;
  cacheStatus: PublishedEndpointInvocationCacheStatus | null;
  runStatus: string | null;
  apiKeyId: string | null;
  reasonCode: string | null;
  timeWindow: PublishTimeWindow;
};

export function resolvePublishTimeWindow(value: string | undefined): PublishTimeWindow {
  if (value === "24h" || value === "7d" || value === "30d") {
    return value;
  }
  return "all";
}

export function resolvePublishWindowRange(window: PublishTimeWindow) {
  if (window === "all") {
    return {};
  }

  const now = new Date();
  const hours = window === "24h" ? 24 : window === "7d" ? 24 * 7 : 24 * 30;
  return {
    createdFrom: new Date(now.getTime() - hours * 60 * 60 * 1000).toISOString(),
    createdTo: now.toISOString()
  };
}
