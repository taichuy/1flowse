import React from "react";

import type { CallbackWaitingAutomationCheck } from "@/lib/get-system-overview";
import type { RunExecutionNodeItem, RunExecutionView } from "@/lib/get-run-views";

import { CallbackWaitingSummaryCard } from "@/components/callback-waiting-summary-card";
import { pickCallbackWaitingSkillTraceForNode } from "@/lib/callback-waiting-focus-skill-trace";
import {
  countPendingApprovals,
  countPendingTickets,
  hasScheduledResume,
  pickTopBlockerNodes
} from "@/lib/run-execution-blockers";
import { resolveSensitiveAccessTimelineEntryRunId } from "@/lib/sensitive-access";
import { buildSensitiveAccessInboxHref } from "@/lib/sensitive-access-links";
import {
  formatExecutionFocusFollowUp,
  formatExecutionFocusPrimarySignal,
  formatExecutionFocusReasonLabel
} from "@/lib/run-execution-focus-presenters";
import { formatTimestamp } from "@/lib/runtime-presenters";

function buildNodeInboxHref(node: RunExecutionNodeItem, defaultRunId?: string | null): string | null {
  const latestApprovalEntry = node.sensitive_access_entries.find((entry) => entry.approval_ticket);
  if (!latestApprovalEntry && node.callback_tickets.length === 0) {
    return null;
  }

  return buildSensitiveAccessInboxHref({
    runId: latestApprovalEntry
      ? resolveSensitiveAccessTimelineEntryRunId(latestApprovalEntry, defaultRunId)
      : defaultRunId ?? null,
    nodeRunId: node.node_run_id,
    status: latestApprovalEntry?.approval_ticket?.status ?? null,
    waitingStatus: latestApprovalEntry?.approval_ticket?.waiting_status ?? null,
    accessRequestId: latestApprovalEntry?.request.id ?? null,
    approvalTicketId: latestApprovalEntry?.approval_ticket?.id ?? null
  });
}

export function RunDiagnosticsExecutionOverviewBlockers({
  executionView,
  callbackWaitingAutomation
}: {
  executionView: RunExecutionView;
  callbackWaitingAutomation: CallbackWaitingAutomationCheck;
}) {
  const focusNode = executionView.execution_focus_node ?? null;
  const skillTrace = executionView.skill_trace ?? null;
  const focusNodeSkillTrace = pickCallbackWaitingSkillTraceForNode(
    skillTrace,
    focusNode?.node_run_id
  );
  const focusNodePrimarySignal =
    executionView.execution_focus_explanation?.primary_signal ??
    (focusNode ? formatExecutionFocusPrimarySignal(focusNode) : null);
  const focusNodeFollowUp =
    executionView.execution_focus_explanation?.follow_up ??
    (focusNode ? formatExecutionFocusFollowUp(focusNode) : null);
  const blockerNodes = pickTopBlockerNodes(executionView).filter(
    (node) => node.node_run_id !== focusNode?.node_run_id
  );

  if (!focusNode && blockerNodes.length === 0) {
    return null;
  }

  return (
    <section>
      <strong>Priority blockers</strong>
      <p className="section-copy entry-copy">
        Run diagnostics now consumes the backend-selected execution focus first, so operator recovery
        starts from the same canonical node that publish detail and runtime facts already agree on.
      </p>
      {focusNode ? (
        <div className="publish-cache-list">
          <article className="payload-card compact-card">
            <div className="payload-card-header">
              <span className="status-meta">Execution focus</span>
              <span className="event-chip">
                {formatExecutionFocusReasonLabel(executionView.execution_focus_reason)}
              </span>
            </div>
            <p className="entry-card-title">{focusNode.node_name}</p>
            <p className="timeline-meta">
              {focusNode.node_type} · node run {focusNode.node_run_id}
            </p>
            <p className="binding-meta">This node is selected from backend execution facts.</p>
            {focusNodePrimarySignal ? (
              <p className="section-copy entry-copy">{focusNodePrimarySignal}</p>
            ) : null}
            {focusNodeFollowUp ? <p className="binding-meta">{focusNodeFollowUp}</p> : null}
            <CallbackWaitingSummaryCard
              callbackTickets={focusNode.callback_tickets}
              callbackWaitingAutomation={callbackWaitingAutomation}
              callbackWaitingExplanation={focusNode.callback_waiting_explanation}
              className="callback-waiting-summary-card"
              focusNodeEvidence={focusNode}
              inboxHref={buildNodeInboxHref(focusNode, executionView.run_id)}
              lifecycle={focusNode.callback_waiting_lifecycle}
              nodeRunId={focusNode.node_run_id}
              runId={executionView.run_id}
              scheduledResumeDelaySeconds={focusNode.scheduled_resume_delay_seconds}
              scheduledResumeSource={focusNode.scheduled_resume_source}
              scheduledWaitingStatus={focusNode.scheduled_waiting_status}
              scheduledResumeScheduledAt={focusNode.scheduled_resume_scheduled_at}
              scheduledResumeDueAt={focusNode.scheduled_resume_due_at}
              scheduledResumeRequeuedAt={focusNode.scheduled_resume_requeued_at}
              scheduledResumeRequeueSource={focusNode.scheduled_resume_requeue_source}
              sensitiveAccessEntries={focusNode.sensitive_access_entries}
              focusSkillTrace={focusNodeSkillTrace}
              focusSkillReferenceCount={focusNode.skill_reference_load_count}
              focusSkillReferenceLoads={focusNode.skill_reference_loads}
              focusSkillReferenceNodeId={focusNode.node_id}
              focusSkillReferenceNodeName={focusNode.node_name}
              waitingReason={focusNode.waiting_reason}
            />
          </article>
        </div>
      ) : null}
      {blockerNodes.length > 0 ? (
      <div className="publish-cache-list">
        {blockerNodes.map((node) => {
          const pendingApprovals = countPendingApprovals(node);
          const pendingTickets = countPendingTickets(node);
          const lifecycle = node.callback_waiting_lifecycle;
          const inboxHref = buildNodeInboxHref(node, executionView.run_id);
          const primarySignal =
            node.execution_focus_explanation?.primary_signal ??
            formatExecutionFocusPrimarySignal(node);
          const followUp =
            node.execution_focus_explanation?.follow_up ??
            formatExecutionFocusFollowUp(node);
          const nodeSkillTrace = pickCallbackWaitingSkillTraceForNode(skillTrace, node.node_run_id);

          return (
            <article className="payload-card compact-card" key={node.node_run_id}>
              <div className="payload-card-header">
                <span className="status-meta">Priority blocker</span>
                <span className={`event-chip`}>{node.status}</span>
              </div>
              <p className="entry-card-title">{node.node_name}</p>
              <p className="timeline-meta">
                {node.node_type} · node run {node.node_run_id}
              </p>
              <p className="binding-meta">
                approvals {pendingApprovals} · callback tickets {node.callback_tickets.length}
                {pendingTickets > 0 ? ` · pending tickets ${pendingTickets}` : ""}
                {typeof lifecycle?.last_resume_delay_seconds === "number"
                  ? ` · last resume ${lifecycle.last_resume_delay_seconds}s`
                  : ""}
              </p>
              {node.started_at ? (
                <p className="binding-meta">Started {formatTimestamp(node.started_at)}</p>
              ) : null}
              {primarySignal ? <p className="section-copy entry-copy">{primarySignal}</p> : null}
              {followUp ? <p className="binding-meta">{followUp}</p> : null}
              <CallbackWaitingSummaryCard
                callbackTickets={node.callback_tickets}
                callbackWaitingAutomation={callbackWaitingAutomation}
                callbackWaitingExplanation={node.callback_waiting_explanation}
                className="callback-waiting-summary-card"
                focusNodeEvidence={node}
                inboxHref={inboxHref}
                lifecycle={lifecycle}
                nodeRunId={node.node_run_id}
                runId={executionView.run_id}
                scheduledResumeDelaySeconds={node.scheduled_resume_delay_seconds}
                scheduledResumeSource={node.scheduled_resume_source}
                scheduledWaitingStatus={node.scheduled_waiting_status}
                scheduledResumeScheduledAt={node.scheduled_resume_scheduled_at}
                scheduledResumeDueAt={node.scheduled_resume_due_at}
                scheduledResumeRequeuedAt={node.scheduled_resume_requeued_at}
                scheduledResumeRequeueSource={node.scheduled_resume_requeue_source}
                sensitiveAccessEntries={node.sensitive_access_entries}
                focusSkillTrace={nodeSkillTrace}
                focusSkillReferenceCount={node.skill_reference_load_count}
                focusSkillReferenceLoads={node.skill_reference_loads}
                focusSkillReferenceNodeId={node.node_id}
                focusSkillReferenceNodeName={node.node_name}
                waitingReason={node.waiting_reason}
              />
            </article>
          );
        })}
      </div>
      ) : null}
    </section>
  );
}
