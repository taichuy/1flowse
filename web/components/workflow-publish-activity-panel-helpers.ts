import type {
  CallbackWaitingAutomationCheck,
  SandboxReadinessCheck
} from "@/lib/get-system-overview";
import { buildAuthorFacingWorkflowDetailLinkSurface } from "@/lib/workbench-entry-surfaces";
import type {
  PluginToolRegistryItem,
} from "@/lib/get-plugin-registry";
import type {
  PublishedEndpointApiKeyItem,
  PublishedEndpointInvocationDetailResponse,
  PublishedEndpointInvocationFacetItem,
  PublishedEndpointInvocationListResponse,
  WorkflowPublishedEndpointItem
} from "@/lib/get-workflow-publish";
import type { SensitiveAccessGuardedResult } from "@/lib/sensitive-access";
import type { WorkflowPublishInvocationActiveFilter } from "@/lib/workflow-publish-governance";
import {
  PUBLISHED_RUN_STATUSES,
  formatPublishedInvocationCacheStatusLabel,
  formatPublishedInvocationReasonLabel,
  formatPublishedInvocationSurfaceLabel,
  formatPublishedRunStatusLabel
} from "@/lib/published-invocation-presenters";

export type WorkflowPublishActivityPanelProps = {
  workflowId: string;
  tools: PluginToolRegistryItem[];
  binding: WorkflowPublishedEndpointItem;
  apiKeys: PublishedEndpointApiKeyItem[];
  invocationAudit: PublishedEndpointInvocationListResponse | null;
  selectedInvocationId: string | null;
  selectedInvocationDetail: SensitiveAccessGuardedResult<PublishedEndpointInvocationDetailResponse>;
  selectedInvocationDetailHref: string | null;
  clearInvocationDetailHref: string | null;
  rateLimitWindowAudit: PublishedEndpointInvocationListResponse | null;
  activeInvocationFilter: WorkflowPublishInvocationActiveFilter | null;
  callbackWaitingAutomation: CallbackWaitingAutomationCheck;
  sandboxReadiness?: SandboxReadinessCheck | null;
};

export const TIME_WINDOW_OPTIONS = [
  { value: "all", label: "全部时间" },
  { value: "24h", label: "最近 24 小时" },
  { value: "7d", label: "最近 7 天" },
  { value: "30d", label: "最近 30 天" }
] as const;

export function facetCount(
  facets: PublishedEndpointInvocationFacetItem[] | undefined,
  value: string
) {
  return facets?.find((item) => item.value === value)?.count ?? 0;
}

export function formatTimeWindowLabel(value: "24h" | "7d" | "30d" | "all") {
  return TIME_WINDOW_OPTIONS.find((option) => option.value === value)?.label ?? "全部时间";
}

export function buildActiveFilterChips(
  activeInvocationFilter: WorkflowPublishActivityPanelProps["activeInvocationFilter"],
  apiKeys: PublishedEndpointApiKeyItem[]
) {
  if (!activeInvocationFilter) {
    return [];
  }

  const chips: string[] = [];
  if (activeInvocationFilter.status) {
    chips.push(`status ${activeInvocationFilter.status}`);
  }
  if (activeInvocationFilter.requestSource) {
    chips.push(`source ${activeInvocationFilter.requestSource}`);
  }
  if (activeInvocationFilter.requestSurface) {
    chips.push(formatPublishedInvocationSurfaceLabel(activeInvocationFilter.requestSurface));
  }
  if (activeInvocationFilter.cacheStatus) {
    chips.push(formatPublishedInvocationCacheStatusLabel(activeInvocationFilter.cacheStatus));
  }
  if (activeInvocationFilter.runStatus) {
    chips.push(formatPublishedRunStatusLabel(activeInvocationFilter.runStatus));
  }
  if (activeInvocationFilter.reasonCode) {
    chips.push(formatPublishedInvocationReasonLabel(activeInvocationFilter.reasonCode));
  }
  if (activeInvocationFilter.apiKeyId) {
    const apiKey = apiKeys.find((item) => item.id === activeInvocationFilter.apiKeyId);
    chips.push(`key ${apiKey?.name ?? apiKey?.key_prefix ?? activeInvocationFilter.apiKeyId}`);
  }
  if (activeInvocationFilter.timeWindow !== "all") {
    chips.push(formatTimeWindowLabel(activeInvocationFilter.timeWindow));
  }
  return chips;
}

export function buildRunStatusOptions(
  runStatusCounts: PublishedEndpointInvocationFacetItem[] | undefined
) {
  const dynamicValues = new Set((runStatusCounts ?? []).map((item) => item.value).filter(Boolean));
  for (const value of PUBLISHED_RUN_STATUSES) {
    dynamicValues.add(value);
  }
  return Array.from(dynamicValues);
}

export function buildWorkflowPublishActivityHref({
  workflowId,
  bindingId,
  activeInvocationFilter,
  invocationId
}: {
  workflowId: string;
  bindingId?: string | null;
  activeInvocationFilter?: WorkflowPublishInvocationActiveFilter | null;
  invocationId?: string | null;
}) {
  const workflowHref = buildAuthorFacingWorkflowDetailLinkSurface({
    workflowId,
    variant: "editor"
  }).href;
  const searchParams = new URLSearchParams();
  const normalizedBindingId = normalizeOptionalQueryValue(bindingId);
  const normalizedRunStatus = normalizeOptionalQueryValue(activeInvocationFilter?.runStatus);
  const normalizedApiKeyId = normalizeOptionalQueryValue(activeInvocationFilter?.apiKeyId);
  const normalizedReasonCode = normalizeOptionalQueryValue(activeInvocationFilter?.reasonCode);
  const normalizedInvocationId = normalizeOptionalQueryValue(invocationId);

  if (normalizedBindingId) {
    searchParams.set("publish_binding", normalizedBindingId);
  }
  if (activeInvocationFilter?.status) {
    searchParams.set("publish_status", activeInvocationFilter.status);
  }
  if (activeInvocationFilter?.requestSource) {
    searchParams.set("publish_request_source", activeInvocationFilter.requestSource);
  }
  if (activeInvocationFilter?.requestSurface) {
    searchParams.set("publish_request_surface", activeInvocationFilter.requestSurface);
  }
  if (activeInvocationFilter?.cacheStatus) {
    searchParams.set("publish_cache_status", activeInvocationFilter.cacheStatus);
  }
  if (normalizedRunStatus) {
    searchParams.set("publish_run_status", normalizedRunStatus);
  }
  if (normalizedApiKeyId) {
    searchParams.set("publish_api_key_id", normalizedApiKeyId);
  }
  if (normalizedReasonCode) {
    searchParams.set("publish_reason_code", normalizedReasonCode);
  }
  if (activeInvocationFilter?.timeWindow && activeInvocationFilter.timeWindow !== "all") {
    searchParams.set("publish_window", activeInvocationFilter.timeWindow);
  }
  if (normalizedInvocationId) {
    searchParams.set("publish_invocation", normalizedInvocationId);
  }

  const query = searchParams.toString();
  return query ? `${workflowHref}?${query}` : workflowHref;
}

function normalizeOptionalQueryValue(value: string | null | undefined) {
  const normalizedValue = value?.trim();
  return normalizedValue ? normalizedValue : null;
}
