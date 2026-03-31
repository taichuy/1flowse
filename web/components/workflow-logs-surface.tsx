import Link from "next/link";

import { RunDiagnosticsExecutionSections } from "@/components/run-diagnostics-execution-sections";
import type { RunDetail } from "@/lib/get-run-detail";
import type {
  CallbackWaitingAutomationCheck,
  SandboxReadinessCheck
} from "@/lib/get-system-overview";
import type { RunEvidenceView, RunExecutionView } from "@/lib/get-run-views";
import { formatDuration, formatTimestamp } from "@/lib/runtime-presenters";
import type { WorkflowLogsSelectionSource } from "@/lib/workflow-logs-surface";

export type WorkflowLogsSurfaceRunItem = {
  id: string;
  workflowVersion: string;
  status: string;
  createdAt: string;
  startedAt?: string | null;
  finishedAt?: string | null;
  lastEventAt?: string | null;
  nodeRunCount: number;
  eventCount: number;
  errorMessage?: string | null;
  logsHref: string;
  detailHref: string;
};

type WorkflowLogsSurfaceProps = {
  workflowId: string;
  recentRuns: WorkflowLogsSurfaceRunItem[];
  selectionSource: WorkflowLogsSelectionSource;
  selectionNotice?: string | null;
  activeRunSummary: WorkflowLogsSurfaceRunItem | null;
  activeRunDetail: RunDetail | null;
  executionView: RunExecutionView | null;
  evidenceView: RunEvidenceView | null;
  publishHref: string;
  runLibraryHref: string;
  workflowEditorHref: string;
  callbackWaitingAutomation: CallbackWaitingAutomationCheck;
  sandboxReadiness?: SandboxReadinessCheck | null;
};

export function WorkflowLogsSurface({
  workflowId,
  recentRuns,
  selectionSource,
  selectionNotice = null,
  activeRunSummary,
  activeRunDetail,
  executionView,
  evidenceView,
  publishHref,
  runLibraryHref,
  workflowEditorHref,
  callbackWaitingAutomation,
  sandboxReadiness = null
}: WorkflowLogsSurfaceProps) {
  if (recentRuns.length === 0) {
    return (
      <div
        className="workspace-panel workflow-logs-empty-state"
        data-component="workflow-logs-empty-state"
      >
        <p className="workflow-studio-placeholder-eyebrow">Run trace facts</p>
        <h2>日志与标注</h2>
        <p>
          当前 workflow 还没有 recent runs；请先从编辑器调试或发布入口触发一次运行，再回来查看
          execution / evidence 追溯。
        </p>
        <div className="workflow-studio-placeholder-actions">
          <Link className="workflow-studio-secondary-link" href={publishHref}>
            查看发布治理
          </Link>
          <Link className="workflow-studio-secondary-link" href={runLibraryHref}>
            打开全局 run 列表
          </Link>
        </div>
      </div>
    );
  }

  const activeRunStatus = activeRunDetail?.status ?? activeRunSummary?.status ?? "unknown";
  const activeRunId = activeRunDetail?.id ?? activeRunSummary?.id ?? "none";
  const activeFocusLabel =
    activeRunDetail?.execution_focus_node?.node_name?.trim() ||
    activeRunDetail?.current_node_id?.trim() ||
    "当前还没有 execution focus";
  const activeErrorMessage =
    activeRunDetail?.error_message?.trim() || activeRunSummary?.errorMessage?.trim() || null;
  const activeLastEventAt = activeRunDetail?.last_event_at ?? activeRunSummary?.lastEventAt ?? null;

  return (
    <div
      className="workflow-logs-surface"
      data-component="workflow-logs-surface"
      data-selection-source={selectionSource}
    >
      <section className="workspace-panel workflow-api-surface-header-panel">
        <div className="workspace-surface-header">
          <div className="workspace-surface-copy workspace-copy-wide">
            <p className="workflow-studio-placeholder-eyebrow">Run trace facts</p>
            <h2>日志与标注</h2>
            <p>
              当前页面直接消费 workflow recent runs、run detail 与 execution / evidence view，
              让作者在 workflow 壳层里先完成一次排障聚焦，再决定是否进入完整 run diagnostics。
            </p>
          </div>
          <div className="workspace-surface-actions workflow-api-surface-actions">
            <Link className="workflow-studio-secondary-link" href={runLibraryHref}>
              打开全局 run 列表
            </Link>
          </div>
        </div>

        <div className="workspace-overview-strip">
          <article className="workspace-stat-card">
            <span>Recent runs</span>
            <strong>{recentRuns.length}</strong>
          </article>
          <article className="workspace-stat-card">
            <span>Active run</span>
            <strong>{activeRunId}</strong>
            <p className="workspace-stat-copy">status: {activeRunStatus}</p>
          </article>
          <article className="workspace-stat-card">
            <span>Last event</span>
            <strong>{formatTimestamp(activeLastEventAt)}</strong>
          </article>
          <article className="workspace-stat-card workspace-stat-card-wide">
            <span>Execution focus</span>
            <strong>{activeFocusLabel}</strong>
            <p className="workspace-stat-copy">
              selection: {selectionSource === "latest" ? "latest run" : selectionSource}
            </p>
          </article>
        </div>
      </section>

      <section className="diagnostics-layout">
        <article className="diagnostic-panel" data-component="workflow-logs-run-list">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Recent runs</p>
              <h2>Workflow scoped timeline entry</h2>
            </div>
            <p className="section-copy">
              只列出当前 workflow 的 recent runs，并保留到当前 surface 的切换入口，避免跨 workflow
              误读 trace 上下文。
            </p>
          </div>

          {selectionNotice ? <p className="section-copy">{selectionNotice}</p> : null}

          <div className="activity-list">
            {recentRuns.map((run) => {
              const isActive = run.id === activeRunSummary?.id;

              return (
                <article
                  className="activity-row"
                  data-active={isActive ? "true" : "false"}
                  data-run-id={run.id}
                  key={run.id}
                >
                  <div className="activity-header">
                    <div>
                      <h3>{isActive ? `当前焦点 · ${run.id}` : `run ${run.id}`}</h3>
                      <p>
                        workflow {workflowId} · version {run.workflowVersion} · node runs {run.nodeRunCount}
                      </p>
                    </div>
                    <span className={`health-pill ${run.status}`}>{run.status}</span>
                  </div>
                  <p className="activity-copy">
                    Created {formatTimestamp(run.createdAt)} · Last event {formatTimestamp(run.lastEventAt)}
                  </p>
                  <p className="event-run">
                    events {run.eventCount} · duration {formatDuration(run.startedAt, run.finishedAt)}
                  </p>
                  {run.errorMessage ? (
                    <p className="run-error-message">{run.errorMessage}</p>
                  ) : (
                    <p className="section-copy">当前 run 没有记录 run 级错误，继续下钻 execution / evidence。</p>
                  )}
                  <div className="section-actions">
                    <Link className="activity-link" href={run.logsHref}>
                      {isActive ? "保持当前焦点" : "切换到此 run"}
                    </Link>
                    <Link className="inline-link secondary" href={run.detailHref}>
                      打开完整 run 诊断
                    </Link>
                  </div>
                </article>
              );
            })}
          </div>
        </article>

        <article className="diagnostic-panel" data-component="workflow-logs-active-run">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Active run</p>
              <h2>Execution / evidence drilldown</h2>
            </div>
            <p className="section-copy">
              先看当前焦点 run 的状态、事件边界和错误说明，再继续顺着 execution / evidence sections
              下钻。
            </p>
          </div>

          {activeRunDetail ? (
            <>
              <div className="summary-strip">
                <article className="summary-card">
                  <span>Status</span>
                  <strong>{activeRunDetail.status}</strong>
                </article>
                <article className="summary-card">
                  <span>Created</span>
                  <strong>{formatTimestamp(activeRunDetail.created_at)}</strong>
                </article>
                <article className="summary-card">
                  <span>Events</span>
                  <strong>{activeRunDetail.event_count}</strong>
                </article>
                <article className="summary-card">
                  <span>Duration</span>
                  <strong>{formatDuration(activeRunDetail.started_at, activeRunDetail.finished_at)}</strong>
                </article>
              </div>

              <div className="meta-grid">
                <article className="summary-card">
                  <span>Execution focus</span>
                  <strong>{activeFocusLabel}</strong>
                </article>
                <article className="summary-card">
                  <span>Last event</span>
                  <strong>{formatTimestamp(activeRunDetail.last_event_at)}</strong>
                </article>
              </div>

              {activeErrorMessage ? (
                <div className="payload-card">
                  <div className="payload-card-header">
                    <span className="status-meta">Run error</span>
                  </div>
                  <pre>{activeErrorMessage}</pre>
                </div>
              ) : null}

              <div className="section-actions">
                {activeRunSummary ? (
                  <Link className="activity-link" href={activeRunSummary.detailHref}>
                    打开完整 run 诊断
                  </Link>
                ) : null}
                <Link className="inline-link secondary" href={workflowEditorHref}>
                  回到编排编辑器
                </Link>
              </div>
            </>
          ) : (
            <p className="empty-state">
              当前 run detail 暂时不可用；请先进入完整 run 诊断或稍后重试，避免在 workflow 壳层里渲染不完整的日志事实。
            </p>
          )}
        </article>
      </section>

      {activeRunDetail ? (
        <RunDiagnosticsExecutionSections
          executionView={executionView}
          evidenceView={evidenceView}
          callbackWaitingAutomation={callbackWaitingAutomation}
          sandboxReadiness={sandboxReadiness}
          workflowDetailHref={workflowEditorHref}
          workflowId={workflowId}
          toolGovernance={activeRunDetail.tool_governance ?? null}
          legacyAuthGovernance={activeRunDetail.legacy_auth_governance ?? null}
          runDetailHref={activeRunSummary?.detailHref ?? null}
        />
      ) : null}
    </div>
  );
}
