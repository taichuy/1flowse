import type { RunSnapshotWithId } from "@/app/actions/run-snapshot";
import { buildOperatorRunSampleCards } from "@/lib/operator-run-sample-cards";
import {
  buildWorkflowPublishPrimaryFollowUpSurface,
  listPublishedInvocationRunFollowUpSampleViews,
} from "@/lib/published-invocation-presenters";
import type {
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

type WorkflowMonitorSurfaceModel = {
  publishedBindings: WorkflowPublishedEndpointItem[];
  totalBindings: number;
  totalInvocations: number;
  timeline: PublishedEndpointInvocationTimeBucketItem[];
  timelineGranularity: "hour" | "day";
  timeWindowLabel: string;
  summaryCards: WorkflowMonitorSummaryCard[];
  sampledRunCards: ReturnType<typeof buildOperatorRunSampleCards>;
  primaryFollowUp: ReturnType<typeof buildWorkflowPublishPrimaryFollowUpSurface>;
  hasInvocationFacts: boolean;
};

type BuildWorkflowMonitorSurfaceModelOptions = {
  bindings: WorkflowPublishedEndpointItem[];
  invocationAuditsByBinding: Record<string, PublishedEndpointInvocationListResponse | null>;
  resolveWorkflowDetailHref?: ((workflowId: string) => string | null) | null;
};

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
  primaryFollowUp,
}: {
  publishedBindings: WorkflowPublishedEndpointItem[];
  invocationSummary: PublishedEndpointInvocationSummary;
  sampledRunCards: ReturnType<typeof buildOperatorRunSampleCards>;
  primaryFollowUp: ReturnType<typeof buildWorkflowPublishPrimaryFollowUpSurface>;
}) {
  const callbackWaitingCount = sampledRunCards.filter((card) => card.hasCallbackWaitingSummary).length;
  const failedSampleCount = sampledRunCards.filter((card) => card.runStatus === "failed").length;

  return [
    {
      key: "published-bindings",
      label: "Published bindings",
      value: String(publishedBindings.length),
      detail: null,
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
      key: "approval-follow-up",
      label: "Approval follow-up",
      value: String(invocationSummary.pending_approval_count ?? 0),
      detail:
        (invocationSummary.pending_notification_count ?? 0) > 0
          ? `pending notifications ${invocationSummary.pending_notification_count}`
          : "当前没有额外 notification backlog。",
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
    {
      key: "summary-focus",
      label: "Summary focus",
      value: primaryFollowUp.tone === "healthy" ? "clear" : "attention",
      detail: primaryFollowUp.headline,
    },
  ] satisfies WorkflowMonitorSummaryCard[];
}

export function buildWorkflowMonitorSurfaceModel({
  bindings,
  invocationAuditsByBinding,
  resolveWorkflowDetailHref = null,
}: BuildWorkflowMonitorSurfaceModelOptions): WorkflowMonitorSurfaceModel {
  const publishedBindings = selectPublishedWorkflowBindings(bindings);
  const audits = publishedBindings.map((binding) => invocationAuditsByBinding[binding.id] ?? null);
  const { timeline, timelineGranularity } = mergeWorkflowMonitorTimelines(audits);
  const invocationSummary = sumInvocationSummary(audits);
  const primaryFollowUp = buildWorkflowPublishPrimaryFollowUpSurface(publishedBindings);
  const sampledRunCards = buildOperatorRunSampleCards(collectRunSamples(audits, resolveWorkflowDetailHref), {
    resolveWorkflowDetailHref,
  });

  return {
    publishedBindings,
    totalBindings: bindings.length,
    totalInvocations: invocationSummary.total_count,
    timeline,
    timelineGranularity,
    timeWindowLabel: buildTimelineWindowLabel(timeline, timelineGranularity),
    sampledRunCards,
    primaryFollowUp,
    hasInvocationFacts:
      invocationSummary.total_count > 0 || timeline.length > 0 || sampledRunCards.length > 0,
    summaryCards: buildWorkflowMonitorSummaryCards({
      publishedBindings,
      invocationSummary,
      sampledRunCards,
      primaryFollowUp,
    }),
  };
}
