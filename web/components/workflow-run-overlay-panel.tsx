"use client";

import React from "react";
import Link from "next/link";

import type { RunSnapshotWithId } from "@/app/actions/run-snapshot";
import { InlineOperatorActionFeedback } from "@/components/inline-operator-action-feedback";
import { RunTraceExportActions } from "@/components/run-trace-export-actions";
import { SandboxExecutionReadinessCard } from "@/components/sandbox-execution-readiness-card";
import { WorkflowGovernanceHandoffCards } from "@/components/workflow-governance-handoff-cards";
import type { NodeRunItem, RunDetail } from "@/lib/get-run-detail";
import type {
  CallbackWaitingAutomationCheck,
  SandboxReadinessCheck
} from "@/lib/get-system-overview";
import {
  DEFAULT_RUN_TRACE_LIMIT,
  type RunTrace
} from "@/lib/get-run-trace";
import type { WorkflowRunListItem } from "@/lib/get-workflow-runs";
import { buildOperatorFollowUpSurfaceCopy } from "@/lib/operator-follow-up-presenters";
import { buildOperatorRunSampleInboxHref } from "@/lib/operator-run-sample-cards";
import { buildExecutionFocusSurfaceDescription } from "@/lib/run-execution-focus-presenters";
import { buildSandboxReadinessNodeFromRunSnapshot } from "@/lib/sandbox-readiness-presenters";
import {
  buildWorkflowGovernanceDetailHrefFromCurrentHref,
  buildWorkflowCatalogGapDetail,
  buildWorkflowGovernanceHandoff
} from "@/lib/workflow-governance-handoff";
import {
  buildAuthorFacingRunDetailLinkSurface,
  buildAuthorFacingWorkflowDetailLinkSurface
} from "@/lib/workbench-entry-surfaces";
import {
  buildWorkflowEditorHrefFromWorkspaceStarterViewState,
  buildRunDetailHrefFromWorkspaceStarterViewState,
  type WorkspaceStarterGovernanceQueryScope
} from "@/lib/workspace-starter-governance-query";
import {
  formatDuration,
  formatDurationMs,
  formatTimestamp,
  cleanNodePayload
} from "@/lib/runtime-presenters";

type WorkflowRunOverlayPanelProps = {
  currentHref?: string | null;
  runs: WorkflowRunListItem[];
  selectedRunId: string | null;
  run: RunDetail | null;
  runSnapshot: RunSnapshotWithId | null;
  trace: RunTrace | null;
  traceError?: string | null;
  selectedNodeId?: string | null;
  callbackWaitingAutomation?: CallbackWaitingAutomationCheck | null;
  sandboxReadiness?: SandboxReadinessCheck | null;
  workspaceStarterGovernanceQueryScope?: WorkspaceStarterGovernanceQueryScope | null;
  isLoading: boolean;
  isRefreshingRuns: boolean;
  onSelectRunId: (runId: string) => void;
  onRefreshRuns: () => void;
};

export function WorkflowRunOverlayPanel({
  currentHref = null,
  runs,
  selectedRunId,
  run,
  runSnapshot,
  trace,
  traceError,
  selectedNodeId,
  callbackWaitingAutomation,
  sandboxReadiness,
  workspaceStarterGovernanceQueryScope = null,
  isLoading,
  isRefreshingRuns,
  onSelectRunId,
  onRefreshRuns
}: WorkflowRunOverlayPanelProps) {
  const runSnapshotModel = runSnapshot?.snapshot ?? null;
  const liveCurrentNodeId = runSnapshotModel?.currentNodeId ?? run?.current_node_id ?? null;
  const currentNodeRun =
    liveCurrentNodeId != null && run
      ? run.node_runs.find((nodeRun) => nodeRun.node_id === liveCurrentNodeId) ?? null
      : null;
  const selectedNodeRun =
    selectedNodeId && run
      ? run.node_runs.find((nodeRun) => nodeRun.node_id === selectedNodeId) ?? null
      : null;
  const focusedNodeRun = selectedNodeRun ?? currentNodeRun ?? run?.node_runs.at(-1) ?? null;
  const focusedNodeRunLabel = selectedNodeRun
    ? "Selected node run"
    : currentNodeRun
      ? "Current node run"
      : "Latest node run";
  const tracePreview = trace?.events.slice(-6) ?? [];
  const sandboxReadinessNode = buildSandboxReadinessNodeFromRunSnapshot(runSnapshotModel);
  const operatorSurfaceCopy = buildOperatorFollowUpSurfaceCopy();
  const runOutputPreview = summarizePayloadPreview(
    cleanNodePayload(run?.output_payload) ?? null,
    run?.status === "failed" ? "当前 run 以失败结束，暂未产生可复用 output。" : "当前 run 还没有 output。"
  );
  const focusedNodeInputPreview = summarizePayloadPreview(
    cleanNodePayload(focusedNodeRun?.input_payload) ?? null,
    "当前节点没有输入 payload。"
  );
  const focusedNodeOutputPreview = summarizePayloadPreview(
    cleanNodePayload(focusedNodeRun?.output_payload) ?? null,
    focusedNodeRun?.error_message
      ? "当前节点以错误结束，暂未产生可复用 output。"
      : "当前节点还没有 output。"
  );
  const runtimeHeadline =
    runSnapshotModel?.callbackWaitingExplanation?.primary_signal ??
    runSnapshotModel?.executionFocusExplanation?.primary_signal ??
    run?.error_message ??
    (runSnapshotModel?.waitingReason
      ? `当前 waiting reason：${runSnapshotModel.waitingReason}`
      : focusedNodeRun?.waiting_reason
        ? `当前节点等待原因：${focusedNodeRun.waiting_reason}`
        : "运行反馈会沿着 node runs、focus snapshot 和 trace preview 自动汇总到这里。");
  const resolveRunDetailHref = React.useCallback(
    (candidateRunId: string) =>
      workspaceStarterGovernanceQueryScope
        ? buildRunDetailHrefFromWorkspaceStarterViewState(
            candidateRunId,
            workspaceStarterGovernanceQueryScope
          )
        : null,
    [workspaceStarterGovernanceQueryScope]
  );
  const scopedWorkflowDetailHref = run
    ? workspaceStarterGovernanceQueryScope
      ? buildWorkflowEditorHrefFromWorkspaceStarterViewState(
          run.workflow_id,
          workspaceStarterGovernanceQueryScope
        )
      : buildAuthorFacingWorkflowDetailLinkSurface({
          workflowId: run.workflow_id,
          variant: "editor"
        }).href
    : null;
  const baseWorkflowDetailHref = run
    ? buildWorkflowGovernanceDetailHrefFromCurrentHref({
        workflowId: run.workflow_id,
        currentHref: currentHref ?? scopedWorkflowDetailHref
      })
    : null;
  const callbackSummaryWorkflowCatalogGapDetail = buildWorkflowCatalogGapDetail({
    toolGovernance: runSnapshot?.toolGovernance ?? run?.tool_governance ?? null,
    subjectLabel: "overlay callback summary",
    returnDetail:
      "先回到 workflow 编辑器补齐 binding / LLM Agent tool policy，再回来继续对照 overlay focus、callback summary 与 trace。"
  });
  const callbackSummaryWorkflowGovernanceHandoff = buildWorkflowGovernanceHandoff({
    workflowId: runSnapshot?.snapshot?.workflowId ?? run?.workflow_id ?? null,
    workflowDetailHref: baseWorkflowDetailHref,
    toolGovernance: runSnapshot?.toolGovernance ?? run?.tool_governance ?? null,
    legacyAuthGovernance: runSnapshot?.legacyAuthGovernance ?? run?.legacy_auth_governance ?? null,
    workflowCatalogGapDetail: callbackSummaryWorkflowCatalogGapDetail
  });
  const callbackWaitingSummaryProps = runSnapshot
    ? {
        currentHref,
        inboxHref: buildOperatorRunSampleInboxHref(runSnapshot),
        callbackTickets: runSnapshot.callbackTickets ?? [],
        callbackWaitingAutomation,
        sensitiveAccessEntries: runSnapshot.sensitiveAccessEntries ?? [],
        showSensitiveAccessInlineActions: false,
        workflowCatalogGapSummary:
          callbackSummaryWorkflowGovernanceHandoff.workflowCatalogGapSummary,
        workflowCatalogGapDetail:
          callbackSummaryWorkflowGovernanceHandoff.workflowCatalogGapDetail,
        workflowCatalogGapHref:
          callbackSummaryWorkflowGovernanceHandoff.workflowCatalogGapHref,
        workflowGovernanceHref:
          callbackSummaryWorkflowGovernanceHandoff.workflowGovernanceHref,
        legacyAuthHandoff: callbackSummaryWorkflowGovernanceHandoff.legacyAuthHandoff
      }
    : undefined;
  const runDrilldownLink = run
    ? buildAuthorFacingRunDetailLinkSurface({
        runId: run.id,
        runHref: resolveRunDetailHref(run.id)
      })
    : null;
  const workflowGovernanceHandoff = buildWorkflowGovernanceHandoff({
    workflowId: run?.workflow_id ?? null,
    workflowDetailHref: baseWorkflowDetailHref,
    toolGovernance: run?.tool_governance ?? null,
    legacyAuthGovernance: run?.legacy_auth_governance ?? null,
    workflowCatalogGapDetail: run
      ? buildWorkflowCatalogGapDetail({
          toolGovernance: run.tool_governance ?? null,
          subjectLabel: "这条 run",
          returnDetail:
            "先回到 workflow 编辑器补齐 binding / LLM Agent tool policy，再回来继续对照当前 node timeline 与 trace。"
        })
      : null
  });

  return (
    <article className="diagnostic-panel editor-panel">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Runtime Overlay</p>
          <h2>Canvas run state</h2>
        </div>
      </div>

      {runs.length === 0 ? (
        <p className="empty-state compact">
          当前 workflow 还没有可复用的 run 记录。等执行链路产生 `runs / node_runs / run_events`
          后，这里会自动承接画布高亮和时间线。
        </p>
      ) : (
        <>
          <div className="binding-actions">
            <label className="binding-field runtime-overlay-select">
              <span className="binding-label">Recent run</span>
              <select
                className="binding-select"
                value={selectedRunId ?? ""}
                onChange={(event) => onSelectRunId(event.target.value)}
              >
                {runs.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.status} · {formatTimestamp(item.created_at)} · {item.id}
                  </option>
                ))}
              </select>
            </label>

            <button
              className="sync-button"
              type="button"
              onClick={onRefreshRuns}
              disabled={isRefreshingRuns}
            >
              {isRefreshingRuns ? "刷新中..." : "刷新 recent runs"}
            </button>
          </div>

          <div className="runtime-overlay-run-rail" aria-label="Recent run rail">
            {runs.map((item) => {
              const isActive = item.id === selectedRunId;

              return (
                <button
                  key={item.id}
                  className={`runtime-overlay-run-pill ${isActive ? "selected" : ""}`}
                  type="button"
                  onClick={() => onSelectRunId(item.id)}
                >
                  <span className={`health-pill ${item.status}`}>{item.status}</span>
                  <strong>{formatTimestamp(item.created_at)}</strong>
                  <span>
                    {item.node_run_count} nodes · {item.event_count} events
                  </span>
                </button>
              );
            })}
          </div>

          {run ? (
            <>
              <div className="payload-card compact-card runtime-overlay-live-drawer">
                <div className="payload-card-header">
                  <span className="status-meta">Live drawer</span>
                  <span className={`health-pill ${run.status}`}>{run.status}</span>
                </div>
                <p className="activity-copy">
                  {focusedNodeRun
                    ? `${focusedNodeRunLabel} · ${focusedNodeRun.node_name} · ${focusedNodeRun.node_type}`
                    : "当前 run 还没有可聚焦的 node run。"}
                </p>
                <p className="section-copy runtime-overlay-headline">{runtimeHeadline}</p>
                <div className="runtime-overlay-drawer-grid">
                  <article className="payload-card compact-card runtime-overlay-mini-card">
                    <span className="binding-meta">Workflow output</span>
                    <p>{runOutputPreview}</p>
                  </article>
                  <article className="payload-card compact-card runtime-overlay-mini-card">
                    <span className="binding-meta">Current step</span>
                    <p>
                      {focusedNodeRun
                        ? `${focusedNodeRun.node_name} · ${focusedNodeRun.status}`
                        : "等待 node run 进入 runtime 视图。"}
                    </p>
                  </article>
                  <article className="payload-card compact-card runtime-overlay-mini-card">
                    <span className="binding-meta">Last activity</span>
                    <p>{formatTimestamp(run.last_event_at ?? run.finished_at ?? run.created_at)}</p>
                  </article>
                </div>
              </div>

              <div className="summary-strip compact-strip">
                <article className="summary-card">
                  <span>Status</span>
                  <strong>{run.status}</strong>
                </article>
                <article className="summary-card">
                  <span>Node runs</span>
                  <strong>{run.node_runs.length}</strong>
                </article>
                <article className="summary-card">
                  <span>Trace events</span>
                  <strong>{trace?.summary.total_event_count ?? run.event_count}</strong>
                </article>
              </div>

              <p className="section-copy">
                Created {formatTimestamp(run.created_at)} · Duration{" "}
                {formatDuration(run.started_at, run.finished_at)} · Workflow version{" "}
                {run.workflow_version}
              </p>

              <WorkflowGovernanceHandoffCards
                workflowCatalogGapSummary={workflowGovernanceHandoff.workflowCatalogGapSummary}
                workflowCatalogGapDetail={workflowGovernanceHandoff.workflowCatalogGapDetail}
                workflowCatalogGapHref={workflowGovernanceHandoff.workflowCatalogGapHref}
                workflowGovernanceHref={workflowGovernanceHandoff.workflowGovernanceHref}
                legacyAuthHandoff={workflowGovernanceHandoff.legacyAuthHandoff}
                cardClassName="payload-card compact-card runtime-overlay-governance-card"
                currentHref={currentHref}
              />

              <div className="hero-actions">
                {runDrilldownLink ? (
                  <Link className="inline-link" href={runDrilldownLink.href}>
                    {runDrilldownLink.label}
                  </Link>
                ) : null}
                <RunTraceExportActions
                  callbackWaitingAutomation={callbackWaitingAutomation}
                  formats={["json"]}
                  query={{
                    limit: DEFAULT_RUN_TRACE_LIMIT,
                    order: "asc"
                  }}
                  requesterId="workflow-run-overlay-export"
                  runId={run.id}
                  sandboxReadiness={sandboxReadiness}
                />
              </div>

              {focusedNodeRun ? (
                <div className="payload-card compact-card runtime-overlay-focus-card">
                  <div className="payload-card-header">
                    <span className="status-meta">{focusedNodeRunLabel}</span>
                    <span className={`health-pill ${focusedNodeRun.status}`}>
                      {focusedNodeRun.status}
                    </span>
                  </div>
                  <p className="activity-copy">
                    {focusedNodeRun.node_name} · {focusedNodeRun.node_type} · node run{" "}
                    {focusedNodeRun.id}
                  </p>
                  <p className="event-run">
                    Started {formatTimestamp(focusedNodeRun.started_at)} · Duration{" "}
                    {formatDuration(focusedNodeRun.started_at, focusedNodeRun.finished_at)}
                  </p>
                  {focusedNodeRun.error_message ? (
                    <p className="run-error-message">{focusedNodeRun.error_message}</p>
                  ) : null}
                  <div className="runtime-overlay-node-preview-grid">
                    <article className="payload-card compact-card runtime-overlay-mini-card">
                      <span className="binding-meta">Input preview</span>
                      <p>{focusedNodeInputPreview}</p>
                    </article>
                    <article className="payload-card compact-card runtime-overlay-mini-card">
                      <span className="binding-meta">Output preview</span>
                      <p>{focusedNodeOutputPreview}</p>
                    </article>
                  </div>
                </div>
              ) : null}

              {runSnapshotModel ? (
                <div className="runtime-overlay-focus-card">
                  <p className="section-copy entry-copy">
                    {buildExecutionFocusSurfaceDescription("overlay")}
                  </p>
                  <InlineOperatorActionFeedback
                    status="success"
                    message=""
                    currentHref={currentHref}
                    resolveRunDetailHref={resolveRunDetailHref}
                    runId={run.id}
                    runSnapshot={runSnapshotModel}
                    callbackWaitingSummaryProps={callbackWaitingSummaryProps}
                    sandboxReadiness={sandboxReadiness}
                    title={operatorSurfaceCopy.executionFocusTitle}
                  />
                  {sandboxReadinessNode ? (
                    <SandboxExecutionReadinessCard
                      node={sandboxReadinessNode}
                      readiness={sandboxReadiness}
                    />
                  ) : null}
                </div>
              ) : (
                <p className="empty-state compact">
                  当前 run 还没有可复用的 canonical execution focus snapshot。
                </p>
              )}

              <div className="timeline-list runtime-overlay-timeline">
                {run.node_runs.length === 0 ? (
                  <p className="empty-state compact">当前 run 还没有节点执行记录。</p>
                ) : (
                  run.node_runs.map((nodeRun) => (
                    <article
                      className={`timeline-row compact-card ${
                        focusedNodeRun?.node_id === nodeRun.node_id ? "selected" : ""
                      }`}
                      key={nodeRun.id}
                    >
                      <div className="activity-header">
                        <div>
                          <h3>{nodeRun.node_name}</h3>
                          <p className="timeline-meta">
                            {nodeRun.node_type} · node {nodeRun.node_id}
                          </p>
                        </div>
                        <span className={`health-pill ${nodeRun.status}`}>
                          {nodeRun.status}
                        </span>
                      </div>
                      <p className="event-run">
                        {formatDuration(nodeRun.started_at, nodeRun.finished_at)} · node run{" "}
                        {nodeRun.id}
                      </p>
                      <p className="section-copy runtime-overlay-timeline-preview">
                        {buildNodeRunProgressPreview(nodeRun)}
                      </p>
                    </article>
                  ))
                )}
              </div>

              <div className="payload-card compact-card runtime-overlay-trace-card">
                <div className="payload-card-header">
                  <span className="status-meta">Trace preview</span>
                  {isLoading ? (
                    <span className="event-chip">loading</span>
                  ) : traceError ? (
                    <span className="event-chip">trace unavailable</span>
                  ) : (
                    <span className="event-chip">
                      {trace?.summary.returned_event_count ?? 0} events
                    </span>
                  )}
                </div>

                {traceError ? (
                  <p className="run-error-message">{traceError}</p>
                ) : tracePreview.length === 0 ? (
                  <p className="empty-state compact">当前没有可展示的 trace 事件。</p>
                ) : (
                  <div className="event-list runtime-overlay-event-list">
                    {tracePreview.map((event) => (
                      <article className="event-row compact-card" key={event.id}>
                        <div className="event-meta">
                          <span>{event.event_type}</span>
                          <span>+{formatDurationMs(event.replay_offset_ms)}</span>
                        </div>
                        <p className="event-run">
                          {event.node_run_id
                            ? `${findNodeRunName(run, event.node_run_id)} · node run ${event.node_run_id}`
                            : `run ${event.run_id}`}
                        </p>
                      </article>
                    ))}
                  </div>
                )}
              </div>
            </>
          ) : (
            <p className="empty-state compact">
              {isLoading
                ? "正在加载选中 run 的 node_runs 与 trace..."
                : "选择一个 recent run 后，这里会显示节点时间线和回放入口。"}
            </p>
          )}
        </>
      )}
    </article>
  );
}

function findNodeRunName(run: RunDetail | null, nodeRunId: string) {
  if (!run) {
    return "unknown node";
  }

  const nodeRun = run.node_runs.find((item) => item.id === nodeRunId);
  return nodeRun?.node_name ?? "unknown node";
}

function buildNodeRunProgressPreview(nodeRun: NodeRunItem): string {
  if (nodeRun.output_payload && Object.keys(nodeRun.output_payload).length > 0) {
    return `Output · ${summarizePayloadPreview(cleanNodePayload(nodeRun.output_payload), "当前节点还没有 output。")}`;
  }

  if (nodeRun.waiting_reason) {
    return `Waiting · ${nodeRun.waiting_reason}`;
  }

  if (nodeRun.error_message) {
    return `Error · ${nodeRun.error_message}`;
  }

  if (nodeRun.input_payload && Object.keys(nodeRun.input_payload).length > 0) {
    return `Input · ${summarizePayloadPreview(cleanNodePayload(nodeRun.input_payload), "当前节点没有输入 payload。")}`;
  }

  return nodeRun.finished_at
    ? "节点已完成，等待进入更细的 run diagnostics 视图。"
    : "节点仍在推进，等待新的 trace 事件。";
}

function summarizePayloadPreview(
  payload: Record<string, unknown> | null | undefined,
  emptyFallback: string
): string {
  if (!payload || Object.keys(payload).length === 0) {
    return emptyFallback;
  }

  const preview = Object.entries(payload)
    .filter(([, value]) => value !== undefined)
    .slice(0, 3)
    .map(([key, value]) => `${key}: ${summarizePayloadValue(value)}`)
    .join(" · ");

  return preview || emptyFallback;
}

function summarizePayloadValue(value: unknown): string {
  if (typeof value === "string") {
    const normalized = value.trim().replace(/\s+/g, " ");
    return normalized.length > 72 ? `${normalized.slice(0, 69)}...` : normalized;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return "[]";
    }

    const head: string = value
      .slice(0, 2)
      .map((item) => summarizePayloadValue(item))
      .join(", ");
    return value.length > 2 ? `[${head}, +${value.length - 2}]` : `[${head}]`;
  }

  if (value && typeof value === "object") {
    const keys = Object.keys(value as Record<string, unknown>);
    return keys.length === 0 ? "{}" : `{${keys.slice(0, 3).join(", ")}}`;
  }

  if (value == null) {
    return "null";
  }

  return "unknown";
}
