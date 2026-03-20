import React from "react";

import type { PublishedEndpointInvocationTimeBucketItem } from "@/lib/get-workflow-publish";
import {
  buildPublishedInvocationTrafficTimelineSurfaceCopy,
  formatPublishedInvocationCacheStatusLabel,
  formatPublishedInvocationReasonLabel,
  formatPublishedInvocationSurfaceLabel,
  formatPublishedRunStatusLabel
} from "@/lib/published-invocation-presenters";
import { formatTimestamp } from "@/lib/runtime-presenters";

type WorkflowPublishTrafficTimelineProps = {
  timeline: PublishedEndpointInvocationTimeBucketItem[];
  timelineGranularity: "hour" | "day";
  timeWindowLabel: string;
};

function formatTimelineBucketLabel(
  value: string,
  granularity: "hour" | "day"
) {
  const date = new Date(value);
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    ...(granularity === "hour"
      ? {
          hour: "2-digit",
          minute: "2-digit",
          hour12: false
        }
      : {})
  }).format(date);
}

function topBucketLabels(
  items: Array<{ value: string; count: number }>,
  formatter: (value: string) => string
) {
  return items.slice(0, 2).map((item) => `${formatter(item.value)} ${item.count}`);
}

function topApiKeyLabels(
  items: PublishedEndpointInvocationTimeBucketItem["api_key_counts"]
) {
  return items
    .slice(0, 2)
    .map((item) => `${item.name ?? item.key_prefix ?? item.api_key_id} ${item.count}`);
}

export function WorkflowPublishTrafficTimeline({
  timeline,
  timelineGranularity,
  timeWindowLabel
}: WorkflowPublishTrafficTimelineProps) {
  const surfaceCopy = buildPublishedInvocationTrafficTimelineSurfaceCopy({
    timelineGranularity,
    timeWindowLabel
  });
  const timelineMaxCount = timeline.reduce(
    (max, bucket) => Math.max(max, bucket.total_count),
    0
  );

  return (
    <div className="entry-card compact-card">
      <p className="entry-card-title">{surfaceCopy.title}</p>
      <p className="section-copy entry-copy">{surfaceCopy.description}</p>

      {timeline.length ? (
        <div className="publish-timeline">
          {timeline.map((bucket) => {
            const width =
              timelineMaxCount > 0
                ? Math.max((bucket.total_count / timelineMaxCount) * 100, bucket.total_count > 0 ? 12 : 0)
                : 0;
            const surfaceLabels = topBucketLabels(
              bucket.request_surface_counts,
              formatPublishedInvocationSurfaceLabel
            );
            const cacheLabels = topBucketLabels(
              bucket.cache_status_counts,
              formatPublishedInvocationCacheStatusLabel
            );
            const runStatusLabels = topBucketLabels(
              bucket.run_status_counts,
              formatPublishedRunStatusLabel
            );
            const reasonLabels = topBucketLabels(
              bucket.reason_counts,
              formatPublishedInvocationReasonLabel
            );
            const apiKeyLabels = topApiKeyLabels(bucket.api_key_counts);

            return (
              <article className="payload-card compact-card" key={bucket.bucket_start}>
                <div className="payload-card-header">
                  <span className="status-meta">
                    {formatTimelineBucketLabel(bucket.bucket_start, timelineGranularity)}
                  </span>
                  <span className="event-chip">
                    {surfaceCopy.totalCountLabel} {bucket.total_count}
                  </span>
                </div>

                <div className="publish-timeline-bar" aria-hidden="true">
                  <span
                    className="publish-timeline-bar-fill"
                    style={{ width: `${width}%` }}
                  />
                </div>

                <p className="section-copy entry-copy publish-timeline-copy">
                  {formatTimestamp(bucket.bucket_start)} - {formatTimestamp(bucket.bucket_end)}
                </p>

                <div className="tool-badge-row">
                  <span className="event-chip">success {bucket.succeeded_count}</span>
                  <span className="event-chip">failed {bucket.failed_count}</span>
                  <span className="event-chip">rejected {bucket.rejected_count}</span>
                </div>

                {surfaceLabels.length ? (
                  <div className="tool-badge-row">
                    {surfaceLabels.map((label) => (
                      <span className="event-chip" key={label}>
                        {label}
                      </span>
                    ))}
                  </div>
                ) : null}

                {cacheLabels.length ? (
                  <div className="tool-badge-row">
                    {cacheLabels.map((label) => (
                      <span className="event-chip" key={label}>
                        {label}
                      </span>
                    ))}
                  </div>
                ) : null}

                {runStatusLabels.length ? (
                  <div className="tool-badge-row">
                    {runStatusLabels.map((label) => (
                      <span className="event-chip" key={label}>
                        {label}
                      </span>
                    ))}
                  </div>
                ) : null}

                {reasonLabels.length ? (
                  <div className="tool-badge-row">
                    {reasonLabels.map((label) => (
                      <span className="event-chip" key={label}>
                        {label}
                      </span>
                    ))}
                  </div>
                ) : null}

                {apiKeyLabels.length ? (
                  <div className="tool-badge-row">
                    {apiKeyLabels.map((label) => (
                      <span className="event-chip" key={label}>
                        {surfaceCopy.apiKeyLabelPrefix} {label}
                      </span>
                    ))}
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      ) : (
        <p className="empty-state compact">{surfaceCopy.emptyState}</p>
      )}
    </div>
  );
}
