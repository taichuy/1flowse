import type { RunSnapshotWithId } from "@/app/actions/run-snapshot";
import { buildOperatorRunSampleCards } from "@/lib/operator-run-sample-cards";
import {
  buildPublishedInvocationActivityInsightsSurface,
  buildWorkflowPublishPrimaryFollowUpSurface,
  listPublishedInvocationRunFollowUpSampleViews,
} from "@/lib/published-invocation-presenters";
import {
  selectWorkflowLogsInvocation,
  type WorkflowLogsSelectionSource,
} from "@/lib/workflow-logs-surface";
import type {
  PublishedEndpointInvocationFacetItem,
  PublishedEndpointInvocationFailureReasonItem,
  PublishedEndpointInvocationApiKeyBucketFacetItem,
  PublishedEndpointInvocationBucketFacetItem,
  PublishedEndpointInvocationListResponse,
  PublishedEndpointInvocationSummary,
  PublishedEndpointInvocationTimeBucketItem,
  WorkflowPublishedEndpointItem,
} from "@/lib/workflow-publish-types";

import { selectPublishedWorkflowBindings } from "@/lib/workflow-api-surface";

type WorkflowMonitorSummaryCard = {
  key: string;
  label: string;
  value: string;
  detail: string | null;
};

type WorkflowMonitorTrendCard = {
  key: string;
  label: string;
  value: string;
  detail: string;
  trendLabel: string;
  tone: "accent" | "success" | "warning" | "neutral";
  series: number[];
};

type WorkflowMonitorWindowSummary = {
  headline: string;
  detail: string;
  chips: string[];
};

type WorkflowMonitorFocusSurface = {
  activeBindingId: string | null;
  selectedInvocationId: string | null;
  selectedRunId: string | null;
  selectionSource: WorkflowLogsSelectionSource;
  selectionNotice: string | null;
  headline: string;
  detail: string;
  chips: string[];
};

type WorkflowMonitorSurfaceModel = {
  publishedBindings: WorkflowPublishedEndpointItem[];
  totalBindings: number;
  totalInvocations: number;
  timeline: PublishedEndpointInvocationTimeBucketItem[];
  timelineGranularity: "hour" | "day";
  timeWindowLabel: string;
  summaryCards: WorkflowMonitorSummaryCard[];
  trendCards: WorkflowMonitorTrendCard[];
  aggregateInvocationAudit: PublishedEndpointInvocationListResponse | null;
  activePublishedBindingCount: number;
  windowSummary: WorkflowMonitorWindowSummary | null;
  insightsSurface: ReturnType<typeof buildPublishedInvocationActivityInsightsSurface> | null;
  sampledRunCards: ReturnType<typeof buildOperatorRunSampleCards>;
  primaryFollowUp: ReturnType<typeof buildWorkflowPublishPrimaryFollowUpSurface>;
  hasInvocationFacts: boolean;
  focus: WorkflowMonitorFocusSurface | null;
};

type BuildWorkflowMonitorSurfaceModelOptions = {
  bindings: WorkflowPublishedEndpointItem[];
  invocationAuditsByBinding: Record<string, PublishedEndpointInvocationListResponse | null>;
  resolveWorkflowDetailHref?: ((workflowId: string) => string | null) | null;
  focusBindingId?: string | null;
  focusInvocationId?: string | null;
  focusRunId?: string | null;
};

function buildWorkflowMonitorFocusState({
  publishedBindings,
  invocationAuditsByBinding,
  focusBindingId,
  focusInvocationId,
  focusRunId,
}: {
  publishedBindings: WorkflowPublishedEndpointItem[];
  invocationAuditsByBinding: Record<string, PublishedEndpointInvocationListResponse | null>;
  focusBindingId: string | null;
  focusInvocationId: string | null;
  focusRunId: string | null;
}) {
  if (!focusBindingId && !focusInvocationId && !focusRunId) {
    return null;
  }

  const invocationSelection = selectWorkflowLogsInvocation(
    publishedBindings,
    invocationAuditsByBinding,
    focusBindingId,
    focusInvocationId
  );
  const activeInvocationItems = invocationSelection.activeBindingId
    ? invocationAuditsByBinding[invocationSelection.activeBindingId]?.items ?? []
    : [];
  const activeInvocationItem =
    activeInvocationItems.find((item) => item.id === invocationSelection.selectedInvocationId) ??
    activeInvocationItems[0] ??
    null;
  const selectedRunId = activeInvocationItem?.run_id ?? focusRunId ?? null;
  const selectionNotice = [
    invocationSelection.selectionNotice,
    focusRunId && selectedRunId && focusRunId !== selectedRunId
      ? `请求的 run ${focusRunId} 不在当前 monitor 聚焦窗口的 sampled follow-up 里，页面已回退到 invocation 关联的 run ${selectedRunId}。`
      : null,
    focusRunId && !selectedRunId
      ? "请求的 run 还没有回接到 monitor 当前窗口的 sampled follow-up，页面继续保留 invocation 级摘要。"
      : null,
  ]
    .filter((notice): notice is string => Boolean(notice))
    .join(" ");

  return {
    activeBindingId: invocationSelection.activeBindingId,
    selectedInvocationId: invocationSelection.selectedInvocationId,
    selectedRunId,
    selectionSource:
      focusBindingId || focusInvocationId
        ? invocationSelection.selectionSource
        : focusRunId
          ? "query"
          : "latest",
    selectionNotice: selectionNotice || null,
  };
}

function buildWorkflowMonitorFocusSurface(
  focusState: ReturnType<typeof buildWorkflowMonitorFocusState>,
  timeWindowLabel: string
): WorkflowMonitorFocusSurface | null {
  if (!focusState) {
    return null;
  }

  return {
    ...focusState,
    headline: focusState.selectedInvocationId
      ? `Fresh sample 已对齐 ${focusState.selectedInvocationId}。`
      : focusState.activeBindingId
        ? `Fresh traffic 已聚焦 ${focusState.activeBindingId}。`
        : focusState.selectedRunId
          ? `Fresh run 已聚焦 ${focusState.selectedRunId}。`
          : "当前 monitor 已聚焦 recent traffic。",
    detail: focusState.selectedInvocationId
      ? `summary、timeline 与 sampled run follow-up 继续围绕同一条 published invocation 所在的 ${timeWindowLabel} 展示，避免把历史流量误读成刚触发的 smoke。`
      : focusState.activeBindingId
        ? `当前 monitor 已按 requested binding 的 ${timeWindowLabel} 汇总流量与 follow-up。`
        : `当前 monitor 继续保留 workflow 级 ${timeWindowLabel} 摘要。`,
    chips: [
      focusState.activeBindingId ? `binding · ${focusState.activeBindingId}` : null,
      focusState.selectedInvocationId
        ? `invocation · ${focusState.selectedInvocationId}`
        : null,
      focusState.selectedRunId ? `run · ${focusState.selectedRunId}` : null,
      `window · ${timeWindowLabel}`,
    ].filter((chip): chip is string => Boolean(chip)),
  };
}

function prioritizeWorkflowMonitorRunSampleCards(
  cards: ReturnType<typeof buildOperatorRunSampleCards>,
  focusRunId: string | null
) {
  if (!focusRunId) {
    return cards;
  }

  const prioritizedCards = cards.filter((card) => card.runId === focusRunId);
  if (prioritizedCards.length === 0) {
    return cards;
  }

  return [
    ...prioritizedCards,
    ...cards.filter((card) => card.runId !== focusRunId),
  ];
}

function mergeBucketFacetCounts(
  existing: PublishedEndpointInvocationBucketFacetItem[],
  next: PublishedEndpointInvocationBucketFacetItem[]
) {
  const merged = new Map<string, PublishedEndpointInvocationBucketFacetItem>();

  for (const item of existing) {
    merged.set(item.value, { ...item });
  }

  for (const item of next) {
    const previous = merged.get(item.value);
    if (previous) {
      previous.count += item.count;
      continue;
    }

    merged.set(item.value, { ...item });
  }

  return [...merged.values()].sort((left, right) => right.count - left.count);
}

function mergeFacetCounts(
  existing: PublishedEndpointInvocationFacetItem[],
  next: PublishedEndpointInvocationFacetItem[]
) {
  const merged = new Map<string, PublishedEndpointInvocationFacetItem>();

  for (const item of existing) {
    merged.set(item.value, { ...item });
  }

  for (const item of next) {
    const previous = merged.get(item.value);
    if (!previous) {
      merged.set(item.value, { ...item });
      continue;
    }

    previous.count += item.count;

    const previousLastInvokedAt = previous.last_invoked_at ?? null;
    const nextLastInvokedAt = item.last_invoked_at ?? null;
    if (nextLastInvokedAt && (!previousLastInvokedAt || nextLastInvokedAt > previousLastInvokedAt)) {
      previous.last_invoked_at = nextLastInvokedAt;
      previous.last_status = item.last_status ?? previous.last_status ?? null;
    }
  }

  return [...merged.values()].sort((left, right) => right.count - left.count);
}

function mergeFailureReasons(
  existing: PublishedEndpointInvocationFailureReasonItem[],
  next: PublishedEndpointInvocationFailureReasonItem[]
) {
  const merged = new Map<string, PublishedEndpointInvocationFailureReasonItem>();

  for (const item of existing) {
    merged.set(item.message, { ...item });
  }

  for (const item of next) {
    const previous = merged.get(item.message);
    if (!previous) {
      merged.set(item.message, { ...item });
      continue;
    }

    previous.count += item.count;
    const previousLastInvokedAt = previous.last_invoked_at ?? null;
    const nextLastInvokedAt = item.last_invoked_at ?? null;
    if (nextLastInvokedAt && (!previousLastInvokedAt || nextLastInvokedAt > previousLastInvokedAt)) {
      previous.last_invoked_at = nextLastInvokedAt;
    }
  }

  return [...merged.values()].sort((left, right) => right.count - left.count);
}

function mergeApiKeyBucketCounts(
  existing: PublishedEndpointInvocationApiKeyBucketFacetItem[],
  next: PublishedEndpointInvocationApiKeyBucketFacetItem[]
) {
  const merged = new Map<string, PublishedEndpointInvocationApiKeyBucketFacetItem>();

  const buildKey = (item: PublishedEndpointInvocationApiKeyBucketFacetItem) =>
    item.api_key_id || [item.key_prefix, item.name].filter(Boolean).join(":") || "unknown";

  for (const item of existing) {
    merged.set(buildKey(item), { ...item });
  }

  for (const item of next) {
    const key = buildKey(item);
    const previous = merged.get(key);
    if (previous) {
      previous.count += item.count;
      previous.api_key_id = previous.api_key_id ?? item.api_key_id ?? null;
      previous.key_prefix = previous.key_prefix ?? item.key_prefix ?? null;
      previous.name = previous.name ?? item.name ?? null;
      continue;
    }

    merged.set(key, { ...item });
  }

  return [...merged.values()].sort((left, right) => right.count - left.count);
}

function mergeWorkflowMonitorTimelines(
  audits: Array<PublishedEndpointInvocationListResponse | null>
) {
  const granularity =
    audits.find((audit) => audit?.facets.timeline_granularity)?.facets.timeline_granularity ??
    "hour";
  const merged = new Map<string, PublishedEndpointInvocationTimeBucketItem>();

  for (const audit of audits) {
    for (const bucket of audit?.facets.timeline ?? []) {
      const key = `${bucket.bucket_start}:${bucket.bucket_end}`;
      const previous = merged.get(key);

      if (!previous) {
        merged.set(key, {
          ...bucket,
          api_key_counts: [...bucket.api_key_counts],
          cache_status_counts: [...bucket.cache_status_counts],
          run_status_counts: [...bucket.run_status_counts],
          request_surface_counts: [...bucket.request_surface_counts],
          reason_counts: [...bucket.reason_counts],
        });
        continue;
      }

      previous.total_count += bucket.total_count;
      previous.succeeded_count += bucket.succeeded_count;
      previous.failed_count += bucket.failed_count;
      previous.rejected_count += bucket.rejected_count;
      previous.api_key_counts = mergeApiKeyBucketCounts(previous.api_key_counts, bucket.api_key_counts);
      previous.cache_status_counts = mergeBucketFacetCounts(
        previous.cache_status_counts,
        bucket.cache_status_counts
      );
      previous.run_status_counts = mergeBucketFacetCounts(
        previous.run_status_counts,
        bucket.run_status_counts
      );
      previous.request_surface_counts = mergeBucketFacetCounts(
        previous.request_surface_counts,
        bucket.request_surface_counts
      );
      previous.reason_counts = mergeBucketFacetCounts(previous.reason_counts, bucket.reason_counts);
    }
  }

  return {
    timelineGranularity: granularity,
    timeline: [...merged.values()].sort((left, right) =>
      left.bucket_start.localeCompare(right.bucket_start)
    ),
  };
}

function buildTimelineWindowLabel(
  timeline: PublishedEndpointInvocationTimeBucketItem[],
  granularity: "hour" | "day"
) {
  if (timeline.length === 0) {
    return granularity === "hour" ? "最近小时窗口" : "最近天窗口";
  }

  if (timeline.length === 1) {
    return granularity === "hour" ? "最近 1 小时窗口" : "最近 1 天窗口";
  }

  return `最近 ${timeline.length} 个${granularity === "hour" ? "小时" : "天"}时间桶`;
}

function sumInvocationSummary(
  audits: Array<PublishedEndpointInvocationListResponse | null>
): PublishedEndpointInvocationSummary {
  return audits.reduce<PublishedEndpointInvocationSummary>(
    (summary, audit) => {
      const current = audit?.summary;
      if (!current) {
        return summary;
      }

      const summaryLastInvokedAt = summary.last_invoked_at ?? null;
      const currentLastInvokedAt = current.last_invoked_at ?? null;
      const shouldPromoteLatestInvocation =
        currentLastInvokedAt != null &&
        (!summaryLastInvokedAt || currentLastInvokedAt > summaryLastInvokedAt);

      return {
        total_count: summary.total_count + current.total_count,
        succeeded_count: summary.succeeded_count + current.succeeded_count,
        failed_count: summary.failed_count + current.failed_count,
        rejected_count: summary.rejected_count + current.rejected_count,
        cache_hit_count: summary.cache_hit_count + current.cache_hit_count,
        cache_miss_count: summary.cache_miss_count + current.cache_miss_count,
        cache_bypass_count: summary.cache_bypass_count + current.cache_bypass_count,
        approval_ticket_count:
          (summary.approval_ticket_count ?? 0) + (current.approval_ticket_count ?? 0),
        pending_approval_count:
          (summary.pending_approval_count ?? 0) + (current.pending_approval_count ?? 0),
        approved_approval_count:
          (summary.approved_approval_count ?? 0) + (current.approved_approval_count ?? 0),
        rejected_approval_count:
          (summary.rejected_approval_count ?? 0) + (current.rejected_approval_count ?? 0),
        expired_approval_count:
          (summary.expired_approval_count ?? 0) + (current.expired_approval_count ?? 0),
        pending_notification_count:
          (summary.pending_notification_count ?? 0) + (current.pending_notification_count ?? 0),
        delivered_notification_count:
          (summary.delivered_notification_count ?? 0) +
          (current.delivered_notification_count ?? 0),
        failed_notification_count:
          (summary.failed_notification_count ?? 0) + (current.failed_notification_count ?? 0),
        last_invoked_at: shouldPromoteLatestInvocation
          ? currentLastInvokedAt
          : summary.last_invoked_at ?? null,
        last_status: shouldPromoteLatestInvocation
          ? current.last_status ?? null
          : summary.last_status ?? null,
        last_cache_status: shouldPromoteLatestInvocation
          ? current.last_cache_status ?? null
          : summary.last_cache_status ?? null,
        last_run_id: shouldPromoteLatestInvocation
          ? current.last_run_id ?? null
          : summary.last_run_id ?? null,
        last_run_status: shouldPromoteLatestInvocation
          ? current.last_run_status ?? null
          : summary.last_run_status ?? null,
        last_reason_code: shouldPromoteLatestInvocation
          ? current.last_reason_code ?? null
          : summary.last_reason_code ?? null,
      };
    },
    {
      total_count: 0,
      succeeded_count: 0,
      failed_count: 0,
      rejected_count: 0,
      cache_hit_count: 0,
      cache_miss_count: 0,
      cache_bypass_count: 0,
      approval_ticket_count: 0,
      pending_approval_count: 0,
      approved_approval_count: 0,
      rejected_approval_count: 0,
      expired_approval_count: 0,
      pending_notification_count: 0,
      delivered_notification_count: 0,
      failed_notification_count: 0,
      primary_sensitive_resource: null,
    }
  );
}

function buildWorkflowMonitorAggregateAudit(
  audits: Array<PublishedEndpointInvocationListResponse | null>,
  timeline: PublishedEndpointInvocationTimeBucketItem[],
  timelineGranularity: "hour" | "day"
) {
  if (audits.every((audit) => audit == null)) {
    return null;
  }

  const summary = sumInvocationSummary(audits);
  const requestSourceCounts = audits.reduce<PublishedEndpointInvocationFacetItem[]>(
    (merged, audit) => mergeFacetCounts(merged, audit?.facets.request_source_counts ?? []),
    []
  );
  const requestSurfaceCounts = audits.reduce<PublishedEndpointInvocationFacetItem[]>(
    (merged, audit) => mergeFacetCounts(merged, audit?.facets.request_surface_counts ?? []),
    []
  );
  const cacheStatusCounts = audits.reduce<PublishedEndpointInvocationFacetItem[]>(
    (merged, audit) => mergeFacetCounts(merged, audit?.facets.cache_status_counts ?? []),
    []
  );
  const runStatusCounts = audits.reduce<PublishedEndpointInvocationFacetItem[]>(
    (merged, audit) => mergeFacetCounts(merged, audit?.facets.run_status_counts ?? []),
    []
  );
  const reasonCounts = audits.reduce<PublishedEndpointInvocationFacetItem[]>(
    (merged, audit) => mergeFacetCounts(merged, audit?.facets.reason_counts ?? []),
    []
  );
  const recentFailureReasons = audits.reduce<PublishedEndpointInvocationFailureReasonItem[]>(
    (merged, audit) => mergeFailureReasons(merged, audit?.facets.recent_failure_reasons ?? []),
    []
  );

  return {
    filters: {},
    summary,
    facets: {
      status_counts: [],
      request_source_counts: requestSourceCounts,
      request_surface_counts: requestSurfaceCounts,
      cache_status_counts: cacheStatusCounts,
      run_status_counts: runStatusCounts,
      reason_counts: reasonCounts,
      api_key_usage: [],
      recent_failure_reasons: recentFailureReasons,
      timeline_granularity: timelineGranularity,
      timeline,
    },
    items: [],
  } satisfies PublishedEndpointInvocationListResponse;
}

function formatMonitorPercentageLabel(value: number) {
  return `${Math.round(value)}%`;
}

function formatMonitorDeltaLabel({
  current,
  previous,
  suffix = "",
  neutralLabel,
}: {
  current: number;
  previous: number | null;
  suffix?: string;
  neutralLabel: string;
}) {
  if (previous == null) {
    return neutralLabel;
  }

  const delta = current - previous;
  const sign = delta > 0 ? "+" : delta < 0 ? "−" : "±";
  const absoluteValue = Math.abs(delta);

  if (absoluteValue === 0) {
    return `${neutralLabel} · 与上一桶持平`;
  }

  return `${neutralLabel} · 较上一桶 ${sign}${absoluteValue}${suffix}`;
}

function readTimelineRunStatusCount(
  bucket: PublishedEndpointInvocationTimeBucketItem,
  status: string
) {
  return bucket.run_status_counts.find((item) => item.value === status)?.count ?? 0;
}

function buildWorkflowMonitorTrendCards({
  timeline,
  invocationSummary,
  activePublishedBindingCount,
  publishedBindings,
  sampledRunCards,
  aggregateInvocationAudit,
  timeWindowLabel,
}: {
  timeline: PublishedEndpointInvocationTimeBucketItem[];
  invocationSummary: PublishedEndpointInvocationSummary;
  activePublishedBindingCount: number;
  publishedBindings: WorkflowPublishedEndpointItem[];
  sampledRunCards: ReturnType<typeof buildOperatorRunSampleCards>;
  aggregateInvocationAudit: PublishedEndpointInvocationListResponse | null;
  timeWindowLabel: string;
}) {
  const latestBucket = timeline.at(-1) ?? null;
  const previousBucket = timeline.length > 1 ? timeline.at(-2) ?? null : null;
  const totalFailureCount = invocationSummary.failed_count + invocationSummary.rejected_count;
  const successRate =
    invocationSummary.total_count > 0
      ? (invocationSummary.succeeded_count / invocationSummary.total_count) * 100
      : 0;
  const successRateSeries = timeline.map((bucket) =>
    bucket.total_count > 0 ? Math.round((bucket.succeeded_count / bucket.total_count) * 100) : 0
  );
  const failureSeries = timeline.map((bucket) => bucket.failed_count + bucket.rejected_count);
  const callbackWaitingSeries = timeline.map((bucket) => readTimelineRunStatusCount(bucket, "waiting_callback"));
  const callbackWaitingCount = callbackWaitingSeries.reduce((sum, value) => sum + value, 0);
  const topReason = aggregateInvocationAudit?.facets.reason_counts.at(0)?.value ?? null;
  const latestSuccessRate =
    latestBucket && latestBucket.total_count > 0
      ? Math.round((latestBucket.succeeded_count / latestBucket.total_count) * 100)
      : 0;
  const previousSuccessRate =
    previousBucket && previousBucket.total_count > 0
      ? Math.round((previousBucket.succeeded_count / previousBucket.total_count) * 100)
      : null;

  return [
    {
      key: "invocations",
      label: "全部调用数",
      value: String(invocationSummary.total_count),
      detail:
        activePublishedBindingCount > 0
          ? `${activePublishedBindingCount}/${publishedBindings.length} 个 published bindings 已看到流量。`
          : "当前 published bindings 还没有活跃调用。",
      trendLabel: formatMonitorDeltaLabel({
        current: latestBucket?.total_count ?? 0,
        previous: previousBucket?.total_count ?? null,
        neutralLabel: `${timeWindowLabel} 最近一桶 ${latestBucket?.total_count ?? 0} 次`,
      }),
      tone: "accent" as const,
      series: timeline.map((bucket) => bucket.total_count),
    },
    {
      key: "success-rate",
      label: "成功率",
      value: formatMonitorPercentageLabel(successRate),
      detail: `success ${invocationSummary.succeeded_count} · failed ${invocationSummary.failed_count} · rejected ${invocationSummary.rejected_count}`,
      trendLabel: formatMonitorDeltaLabel({
        current: latestSuccessRate,
        previous: previousSuccessRate,
        suffix: "pp",
        neutralLabel: `${timeWindowLabel} 最近一桶 ${formatMonitorPercentageLabel(latestSuccessRate)}`,
      }),
      tone: invocationSummary.failed_count === 0 && invocationSummary.rejected_count === 0 ? "success" : "neutral",
      series: successRateSeries,
    },
    {
      key: "failure-pressure",
      label: "失败 / 拒绝",
      value: String(totalFailureCount),
      detail: topReason ? `主要错误信号：${topReason}` : "当前时间窗没有聚合出的错误原因峰值。",
      trendLabel: formatMonitorDeltaLabel({
        current: (latestBucket?.failed_count ?? 0) + (latestBucket?.rejected_count ?? 0),
        previous:
          previousBucket == null ? null : previousBucket.failed_count + previousBucket.rejected_count,
        neutralLabel: `${timeWindowLabel} 最近一桶 ${(latestBucket?.failed_count ?? 0) + (latestBucket?.rejected_count ?? 0)} 次`,
      }),
      tone: totalFailureCount > 0 ? "warning" : "success",
      series: failureSeries,
    },
    {
      key: "callback-pressure",
      label: "Waiting callback",
      value: String(callbackWaitingCount),
      detail:
        sampledRunCards.length > 0
          ? `${sampledRunCards.filter((card) => card.hasCallbackWaitingSummary).length} 个 sampled runs 仍在等待 callback 或 follow-up。`
          : "当前时间窗还没有 sampled run follow-up。",
      trendLabel: formatMonitorDeltaLabel({
        current: callbackWaitingSeries.at(-1) ?? 0,
        previous: callbackWaitingSeries.length > 1 ? callbackWaitingSeries.at(-2) ?? null : null,
        neutralLabel: `${timeWindowLabel} 最近一桶 ${callbackWaitingSeries.at(-1) ?? 0} 个 waiting runs`,
      }),
      tone: callbackWaitingCount > 0 ? "warning" : "neutral",
      series: callbackWaitingSeries,
    },
  ] satisfies WorkflowMonitorTrendCard[];
}

function buildWorkflowMonitorWindowSummary({
  timeline,
  aggregateInvocationAudit,
  activePublishedBindingCount,
}: {
  timeline: PublishedEndpointInvocationTimeBucketItem[];
  aggregateInvocationAudit: PublishedEndpointInvocationListResponse | null;
  activePublishedBindingCount: number;
}) {
  if (!timeline.length || !aggregateInvocationAudit) {
    return null;
  }

  const busiestBucket = [...timeline].sort((left, right) => right.total_count - left.total_count)[0] ?? null;
  const latestBucket = timeline.at(-1) ?? null;
  if (!busiestBucket || !latestBucket) {
    return null;
  }

  const topSurface = aggregateInvocationAudit.facets.request_surface_counts.at(0)?.value ?? null;
  const topReason = aggregateInvocationAudit.facets.reason_counts.at(0)?.value ?? null;
  const chips = [
    topSurface ? `top surface · ${topSurface}` : null,
    topReason ? `top reason · ${topReason}` : null,
    `active bindings · ${activePublishedBindingCount}`,
  ].filter((chip): chip is string => Boolean(chip));

  return {
    headline: `峰值时间桶 ${busiestBucket.total_count} 次；最新时间桶 ${latestBucket.total_count} 次。`,
    detail:
      aggregateInvocationAudit.summary.last_invoked_at
        ? `最近一次调用出现在 ${aggregateInvocationAudit.summary.last_invoked_at}；监测页继续围绕 workflow-scoped published invocation 事实给出趋势和 backlog 摘要。`
        : "当前时间窗只有聚合桶，没有补齐最后一次调用时间。",
    chips,
  } satisfies WorkflowMonitorWindowSummary;
}

function collectRunSamples(
  audits: Array<PublishedEndpointInvocationListResponse | null>,
  resolveWorkflowDetailHref?: ((workflowId: string) => string | null) | null
) {
  const samplesByRunId = new Map<string, RunSnapshotWithId>();

  for (const audit of audits) {
    for (const item of audit?.items ?? []) {
      const sampleViews = listPublishedInvocationRunFollowUpSampleViews(item.run_follow_up, {
        fallbackWorkflowId: item.workflow_id,
        resolveWorkflowDetailHref,
      });

      for (const sample of sampleViews) {
        const previous = samplesByRunId.get(sample.run_id);
        if (previous?.snapshot && sample.run_snapshot) {
          continue;
        }

        samplesByRunId.set(sample.run_id, {
          runId: sample.run_id,
          snapshot: sample.run_snapshot,
          callbackTickets: sample.callback_tickets,
          sensitiveAccessEntries: sample.sensitive_access_entries,
          toolGovernance: sample.tool_governance,
          legacyAuthGovernance: sample.legacy_auth_governance,
        });
      }
    }
  }

  return [...samplesByRunId.values()];
}

function buildWorkflowMonitorSummaryCards({
  publishedBindings,
  invocationSummary,
  sampledRunCards,
  activePublishedBindingCount,
}: {
  publishedBindings: WorkflowPublishedEndpointItem[];
  invocationSummary: PublishedEndpointInvocationSummary;
  sampledRunCards: ReturnType<typeof buildOperatorRunSampleCards>;
  activePublishedBindingCount: number;
}) {
  const callbackWaitingCount = sampledRunCards.filter((card) => card.hasCallbackWaitingSummary).length;
  const failedSampleCount = sampledRunCards.filter((card) => card.runStatus === "failed").length;
  const followUpBacklogCount =
    (invocationSummary.pending_approval_count ?? 0) +
    (invocationSummary.pending_notification_count ?? 0) +
    callbackWaitingCount;

  return [
    {
      key: "published-bindings",
      label: "Published bindings",
      value: String(publishedBindings.length),
      detail:
        activePublishedBindingCount > 0
          ? `${activePublishedBindingCount} 个 bindings 在当前时间窗里出现流量。`
          : "当前还没有 binding 进入活跃流量窗口。",
    },
    {
      key: "follow-up-backlog",
      label: "Follow-up backlog",
      value: String(followUpBacklogCount),
      detail:
        followUpBacklogCount > 0
          ? `pending approvals ${invocationSummary.pending_approval_count ?? 0} · notifications ${invocationSummary.pending_notification_count ?? 0}`
          : "当前没有共享 follow-up / approval backlog。",
    },
    {
      key: "invocations",
      label: "Invocations",
      value: String(invocationSummary.total_count),
      detail:
        invocationSummary.total_count > 0
          ? `success ${invocationSummary.succeeded_count} · failed ${invocationSummary.failed_count} · rejected ${invocationSummary.rejected_count}`
          : "当前还没有 workflow 级 invocation 样本。",
    },
    {
      key: "sampled-runs",
      label: "Sampled runs",
      value: String(sampledRunCards.length),
      detail:
        callbackWaitingCount > 0
          ? `callback waiting ${callbackWaitingCount}`
          : failedSampleCount > 0
            ? `failed sampled runs ${failedSampleCount}`
            : sampledRunCards.length > 0
              ? "当前 sample 主要用于 execution / follow-up 对照。"
              : "当前时间窗还没有 sampled run follow-up。",
    },
  ] satisfies WorkflowMonitorSummaryCard[];
}

export function buildWorkflowMonitorSurfaceModel({
  bindings,
  invocationAuditsByBinding,
  resolveWorkflowDetailHref = null,
  focusBindingId = null,
  focusInvocationId = null,
  focusRunId = null,
}: BuildWorkflowMonitorSurfaceModelOptions): WorkflowMonitorSurfaceModel {
  const publishedBindings = selectPublishedWorkflowBindings(bindings);
  const focusState = buildWorkflowMonitorFocusState({
    publishedBindings,
    invocationAuditsByBinding,
    focusBindingId,
    focusInvocationId,
    focusRunId,
  });
  const scopedBindings = focusState?.activeBindingId
    ? publishedBindings.filter((binding) => binding.id === focusState.activeBindingId)
    : publishedBindings;
  const audits = scopedBindings.map((binding) => invocationAuditsByBinding[binding.id] ?? null);
  const { timeline, timelineGranularity } = mergeWorkflowMonitorTimelines(audits);
  const invocationSummary = sumInvocationSummary(audits);
  const aggregateInvocationAudit = buildWorkflowMonitorAggregateAudit(
    audits,
    timeline,
    timelineGranularity
  );
  const primaryFollowUp = buildWorkflowPublishPrimaryFollowUpSurface(publishedBindings);
  const timeWindowLabel = buildTimelineWindowLabel(timeline, timelineGranularity);
  const sampledRunCards = prioritizeWorkflowMonitorRunSampleCards(
    buildOperatorRunSampleCards(collectRunSamples(audits, resolveWorkflowDetailHref), {
      resolveWorkflowDetailHref,
    }),
    focusState?.selectedRunId ?? focusRunId
  );
  const activePublishedBindingCount = audits.filter((audit) => (audit?.summary.total_count ?? 0) > 0).length;
  const hasInvocationFacts =
    invocationSummary.total_count > 0 || timeline.length > 0 || sampledRunCards.length > 0;
  const insightsSurface = aggregateInvocationAudit
    ? buildPublishedInvocationActivityInsightsSurface({
        invocationAudit: aggregateInvocationAudit,
        timeWindowLabel,
      })
    : null;

  return {
    publishedBindings,
    totalBindings: bindings.length,
    totalInvocations: invocationSummary.total_count,
    timeline,
    timelineGranularity,
    timeWindowLabel,
    sampledRunCards,
    primaryFollowUp,
    aggregateInvocationAudit,
    activePublishedBindingCount,
    windowSummary: buildWorkflowMonitorWindowSummary({
      timeline,
      aggregateInvocationAudit,
      activePublishedBindingCount,
    }),
    trendCards: buildWorkflowMonitorTrendCards({
      timeline,
      invocationSummary,
      activePublishedBindingCount,
      publishedBindings,
      sampledRunCards,
      aggregateInvocationAudit,
      timeWindowLabel,
    }),
    insightsSurface,
    hasInvocationFacts,
    summaryCards: buildWorkflowMonitorSummaryCards({
      publishedBindings,
      invocationSummary,
      sampledRunCards,
      activePublishedBindingCount,
    }),
    focus: buildWorkflowMonitorFocusSurface(focusState, timeWindowLabel),
  };
}
