import Link from "next/link";

import type { PublishedEndpointInvocationListResponse } from "@/lib/get-workflow-publish";
import {
  formatPublishedInvocationCacheStatusLabel,
  formatPublishedInvocationReasonLabel,
  formatPublishedInvocationSurfaceLabel
} from "@/lib/published-invocation-presenters";
import { formatDurationMs, formatKeyList, formatTimestamp } from "@/lib/runtime-presenters";

type PublishedInvocationItem = PublishedEndpointInvocationListResponse["items"][number];

type WorkflowPublishInvocationEntryCardProps = {
  item: PublishedInvocationItem;
  detailHref: string;
  detailActive: boolean;
};

function formatMetricCounts(metrics: Record<string, number> | null | undefined): string {
  if (!metrics) {
    return "n/a";
  }

  const parts = Object.entries(metrics)
    .filter(([, count]) => count > 0)
    .map(([label, count]) => `${label} ${count}`);

  return parts.length ? parts.join(" · ") : "0";
}

function formatScheduledResume(item: PublishedInvocationItem): string {
  const scheduledResume = item.run_waiting_lifecycle;
  if (!scheduledResume?.scheduled_resume_delay_seconds) {
    return "n/a";
  }

  const parts = [`${scheduledResume.scheduled_resume_delay_seconds}s`];
  if (scheduledResume.scheduled_resume_source) {
    parts.push(scheduledResume.scheduled_resume_source);
  }
  if (scheduledResume.scheduled_waiting_status) {
    parts.push(scheduledResume.scheduled_waiting_status);
  }
  return parts.join(" · ");
}

function formatCallbackLifecycle(item: PublishedInvocationItem): string | null {
  const lifecycle = item.run_waiting_lifecycle?.callback_waiting_lifecycle;
  if (!lifecycle) {
    return null;
  }

  const parts: string[] = [];
  if (lifecycle.wait_cycle_count > 0) {
    parts.push(`wait cycles ${lifecycle.wait_cycle_count}`);
  }
  if (lifecycle.expired_ticket_count > 0) {
    parts.push(`expired ${lifecycle.expired_ticket_count}`);
  }
  if (lifecycle.late_callback_count > 0) {
    parts.push(`late callbacks ${lifecycle.late_callback_count}`);
  }
  if (typeof lifecycle.last_resume_delay_seconds === "number") {
    parts.push(`resume ${lifecycle.last_resume_delay_seconds}s`);
  }
  if (lifecycle.last_resume_backoff_attempt > 0) {
    parts.push(`backoff #${lifecycle.last_resume_backoff_attempt}`);
  }

  return parts.length ? parts.join(" · ") : "callback lifecycle tracked";
}

function hasInvocationDrilldown(item: PublishedInvocationItem): boolean {
  return Boolean(
    item.error_message ||
      item.response_preview ||
      item.request_preview ||
      item.run_waiting_lifecycle ||
      item.finished_at
  );
}

export function WorkflowPublishInvocationEntryCard({
  item,
  detailHref,
  detailActive
}: WorkflowPublishInvocationEntryCardProps) {
  const callbackLifecycle = formatCallbackLifecycle(item);

  return (
    <article className="payload-card compact-card">
      <div className="payload-card-header">
        <span className={`health-pill ${item.status}`}>{item.status}</span>
        <div className="tool-badge-row">
          <span className="event-chip">
            {formatPublishedInvocationCacheStatusLabel(item.cache_status)}
          </span>
          {item.reason_code ? (
            <span className="event-chip">{formatPublishedInvocationReasonLabel(item.reason_code)}</span>
          ) : null}
        </div>
      </div>
      <p className="binding-meta">
        {formatPublishedInvocationSurfaceLabel(item.request_surface)} · {item.request_source} ·{" "}
        {formatTimestamp(item.created_at)} · {formatDurationMs(item.duration_ms)}
      </p>
      <dl className="compact-meta-list">
        <div>
          <dt>API key</dt>
          <dd>{item.api_key_name ?? item.api_key_prefix ?? "internal"}</dd>
        </div>
        <div>
          <dt>Request keys</dt>
          <dd>{formatKeyList(item.request_preview.keys ?? [])}</dd>
        </div>
        <div>
          <dt>Run</dt>
          <dd>
            {item.run_id ? (
              <Link className="inline-link" href={`/runs/${encodeURIComponent(item.run_id)}`}>
                {item.run_id}
              </Link>
            ) : (
              "not-started"
            )}
          </dd>
        </div>
        <div>
          <dt>Run status</dt>
          <dd>{item.run_status ?? "n/a"}</dd>
        </div>
        <div>
          <dt>Current node</dt>
          <dd>{item.run_current_node_id ?? "n/a"}</dd>
        </div>
        <div>
          <dt>Waiting reason</dt>
          <dd>{item.run_waiting_reason ?? "n/a"}</dd>
        </div>
        <div>
          <dt>Callback tickets</dt>
          <dd>
            {item.run_waiting_lifecycle
              ? `${item.run_waiting_lifecycle.callback_ticket_count} · ${formatMetricCounts(item.run_waiting_lifecycle.callback_ticket_status_counts)}`
              : "n/a"}
          </dd>
        </div>
        <div>
          <dt>Scheduled resume</dt>
          <dd>{formatScheduledResume(item)}</dd>
        </div>
      </dl>
      {item.run_status === "waiting" ? (
        <p className="section-copy entry-copy">
          该请求已成功接入 durable runtime，当前仍处于 waiting；可直接打开 run detail 继续追踪
          {item.run_current_node_id ? `，当前节点 ${item.run_current_node_id}` : ""}
          {item.run_waiting_reason ? `，等待原因 ${item.run_waiting_reason}` : ""}。
        </p>
      ) : null}
      {item.run_waiting_lifecycle ? (
        <p className="section-copy entry-copy">
          waiting drilldown：node run {item.run_waiting_lifecycle.node_run_id} · node status{" "}
          {item.run_waiting_lifecycle.node_status}
          {item.run_waiting_lifecycle.callback_ticket_count
            ? ` · callback tickets ${item.run_waiting_lifecycle.callback_ticket_count}`
            : ""}
          {item.run_waiting_lifecycle.scheduled_resume_delay_seconds
            ? ` · scheduled resume ${formatScheduledResume(item)}`
            : ""}
          {callbackLifecycle ? ` · ${callbackLifecycle}` : ""}
          。
        </p>
      ) : null}
      {item.run_status === "succeeded" ? (
        <p className="section-copy entry-copy">
          该请求已经走完整条 publish 调用链，run 已结束，可以直接对照 response preview 做回放。
        </p>
      ) : null}
      {item.error_message ? <p className="section-copy entry-copy">error: {item.error_message}</p> : null}
      {hasInvocationDrilldown(item) ? (
        <div className="publish-invocation-actions">
          <Link className="inline-link" href={detailHref}>
            {detailActive ? "查看当前详情" : "打开 invocation detail"}
          </Link>
          <span className="section-copy entry-copy">
            详情面板会补 run / callback ticket / callback lifecycle / cache 四类稳定排障入口。
          </span>
        </div>
      ) : null}
    </article>
  );
}
