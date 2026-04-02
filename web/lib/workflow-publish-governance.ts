import type {
  PublishedEndpointInvocationCacheStatus,
  PublishedEndpointInvocationRequestSource,
  PublishedEndpointInvocationRequestSurface,
  PublishedEndpointInvocationStatus
} from "@/lib/get-workflow-publish";

export type PublishTimeWindow =
  | "24h"
  | "7d"
  | "30d"
  | "hour"
  | "day"
  | "month"
  | "year"
  | "all";

const PUBLISH_TIME_WINDOW_HOURS: Record<Exclude<PublishTimeWindow, "all">, number> = {
  "24h": 24,
  "7d": 24 * 7,
  "30d": 24 * 30,
  hour: 48,
  day: 24 * 30,
  month: 24 * 365,
  year: 24 * 365 * 3,
};

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
  if (
    value === "24h" ||
    value === "7d" ||
    value === "30d" ||
    value === "hour" ||
    value === "day" ||
    value === "month" ||
    value === "year"
  ) {
    return value;
  }
  return "all";
}

export function resolvePublishWindowRange(window: PublishTimeWindow) {
  if (window === "all") {
    return {};
  }

  const now = new Date();
  const hours = PUBLISH_TIME_WINDOW_HOURS[window];
  return {
    createdFrom: new Date(now.getTime() - hours * 60 * 60 * 1000).toISOString(),
    createdTo: now.toISOString()
  };
}
