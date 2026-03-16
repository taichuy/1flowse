import type { RunExecutionNodeItem } from "@/lib/get-run-views";
import {
  formatDuration,
  formatDurationMs,
  formatJsonPayload,
  formatTimestamp
} from "@/lib/runtime-presenters";

import {
  ArtifactPreviewList,
  MetricChipRow
} from "@/components/run-diagnostics-execution/shared";
import { CallbackWaitingSummaryCard } from "@/components/callback-waiting-summary-card";
import { SensitiveAccessTimelineEntryList } from "@/components/sensitive-access-timeline-entry-list";
import { buildSensitiveAccessInboxHref } from "@/lib/sensitive-access-links";

export function ExecutionNodeCard({ node }: { node: RunExecutionNodeItem }) {
  const latestApprovalEntry = node.sensitive_access_entries.find((entry) => entry.approval_ticket);
  const inboxHref =
    node.sensitive_access_entries.length > 0 || node.callback_tickets.length > 0
      ? buildSensitiveAccessInboxHref({
          runId: latestApprovalEntry?.request.run_id ?? latestApprovalEntry?.approval_ticket?.run_id ?? null,
          nodeRunId: node.node_run_id,
          status: latestApprovalEntry?.approval_ticket?.status ?? null,
          waitingStatus: latestApprovalEntry?.approval_ticket?.waiting_status ?? null,
          accessRequestId: latestApprovalEntry?.request.id ?? null,
          approvalTicketId: latestApprovalEntry?.approval_ticket?.id ?? null
        })
      : null;

  return (
    <article className="timeline-row">
      <div className="activity-header">
        <div>
          <h3>{node.node_name}</h3>
          <p className="timeline-meta">
            {node.node_type} · node {node.node_id}
          </p>
        </div>
        <span className={`health-pill ${node.status}`}>{node.status}</span>
      </div>

      <p className="activity-copy">
        Phase {node.phase ?? "n/a"} · Started {formatTimestamp(node.started_at)} · Finished{" "}
        {formatTimestamp(node.finished_at)} · Duration {formatDuration(node.started_at, node.finished_at)}
      </p>
      <p className="event-run">node run {node.node_run_id}</p>

      {node.error_message ? <p className="run-error-message">{node.error_message}</p> : null}

      <div className="event-type-strip">
        <span className="event-chip">exec {node.execution_class}</span>
        <span className="event-chip">source {node.execution_source}</span>
        {node.execution_profile ? (
          <span className="event-chip">profile {node.execution_profile}</span>
        ) : null}
        {typeof node.execution_timeout_ms === "number" ? (
          <span className="event-chip">timeout {formatDurationMs(node.execution_timeout_ms)}</span>
        ) : null}
        {node.execution_network_policy ? (
          <span className="event-chip">network {node.execution_network_policy}</span>
        ) : null}
        {node.execution_filesystem_policy ? (
          <span className="event-chip">fs {node.execution_filesystem_policy}</span>
        ) : null}
      </div>

      <div className="event-type-strip">
        <span className="event-chip">events {node.event_count}</span>
        <span className="event-chip">artifacts {node.artifacts.length}</span>
        <span className="event-chip">tools {node.tool_calls.length}</span>
        <span className="event-chip">ai {node.ai_calls.length}</span>
        {node.callback_tickets.length > 0 ? (
          <span className="event-chip">tickets {node.callback_tickets.length}</span>
        ) : null}
        {node.last_event_type ? <span className="event-chip">last {node.last_event_type}</span> : null}
      </div>

      <CallbackWaitingSummaryCard
        lifecycle={node.callback_waiting_lifecycle}
        callbackTickets={node.callback_tickets}
        sensitiveAccessEntries={node.sensitive_access_entries}
        waitingReason={node.waiting_reason}
        inboxHref={inboxHref}
      />

      <MetricChipRow
        title="Event types"
        emptyCopy="No node-level events were recorded for this execution node."
        metrics={node.event_type_counts}
        prefix="event"
      />

      {node.tool_calls.length > 0 ? (
        <div className="event-list">
          {node.tool_calls.map((toolCall) => (
            <article className="event-row compact-card" key={toolCall.id}>
              <div className="event-meta">
                <span>{toolCall.tool_name}</span>
                <span>{toolCall.status}</span>
              </div>
              <p className="event-run">
                {toolCall.phase} · {formatDurationMs(toolCall.latency_ms)} · tool {toolCall.tool_id}
              </p>
              <pre>
                {formatJsonPayload({
                  request_summary: toolCall.request_summary,
                  response_summary: toolCall.response_summary,
                  raw_ref: toolCall.raw_ref
                })}
              </pre>
            </article>
          ))}
        </div>
      ) : null}

      {node.ai_calls.length > 0 ? (
        <div className="event-list">
          {node.ai_calls.map((aiCall) => (
            <article className="event-row compact-card" key={aiCall.id}>
              <div className="event-meta">
                <span>{aiCall.role}</span>
                <span>{aiCall.status}</span>
              </div>
              <p className="event-run">
                {aiCall.provider ?? "provider?"} · {aiCall.model_id ?? "model?"} · {formatDurationMs(aiCall.latency_ms)}
              </p>
              <pre>
                {formatJsonPayload({
                  input_summary: aiCall.input_summary,
                  output_summary: aiCall.output_summary,
                  assistant: aiCall.assistant,
                  token_usage: aiCall.token_usage
                })}
              </pre>
            </article>
          ))}
        </div>
      ) : null}

      {node.callback_tickets.length > 0 ? (
        <div className="event-list">
          {node.callback_tickets.map((ticket) => (
            <article className="event-row compact-card" key={ticket.ticket}>
              <div className="event-meta">
                <span>{ticket.status}</span>
                <span>{ticket.waiting_status}</span>
              </div>
              <p className="event-run">
                ticket {ticket.ticket} · tool {ticket.tool_id ?? "n/a"}
              </p>
              <pre>
                {formatJsonPayload({
                  reason: ticket.reason,
                  callback_payload: ticket.callback_payload
                })}
              </pre>
            </article>
          ))}
        </div>
      ) : null}

      {node.sensitive_access_entries.length > 0 ? (
        <>
          <p className="section-copy entry-copy">Sensitive access timeline</p>
          <SensitiveAccessTimelineEntryList
            entries={node.sensitive_access_entries}
            emptyCopy="No sensitive access decisions were recorded for this node."
            defaultRunId={latestApprovalEntry?.request.run_id ?? latestApprovalEntry?.approval_ticket?.run_id ?? null}
          />
        </>
      ) : null}

      <ArtifactPreviewList artifacts={node.artifacts} />
    </article>
  );
}
