import Link from "next/link";

import { RunDiagnosticsExecutionSections } from "@/components/run-diagnostics-execution-sections";
import { resolveWorkflowPublishSelectedInvocationDetailSurface } from "@/components/workflow-publish-activity-panel-helpers";
import { WorkflowPublishInvocationDetailPanel } from "@/components/workflow-publish-invocation-detail-panel";
import { WorkflowPublishInvocationEntryCard } from "@/components/workflow-publish-invocation-entry-card";
import type {
  PublishedEndpointInvocationDetailResponse,
  PublishedEndpointInvocationListResponse
} from "@/lib/get-workflow-publish";
import type { RunDetail } from "@/lib/get-run-detail";
import type {
  CallbackWaitingAutomationCheck,
  SandboxReadinessCheck
} from "@/lib/get-system-overview";
import type { RunEvidenceView, RunExecutionView } from "@/lib/get-run-views";
import { formatTimestamp } from "@/lib/runtime-presenters";
import type { SensitiveAccessGuardedResult } from "@/lib/sensitive-access";
import type { WorkflowPublishActivityWorkflowLike } from "@/lib/workflow-publish-activity-query";
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

export type WorkflowLogsSurfaceBindingItem = {
  id: string;
  endpointAlias: string;
  routePath: string;
  protocol: string;
  authMode: string;
  workflowVersion: string;
};

type WorkflowLogsSurfaceProps = {
  workflowId: string;
  workflow?: WorkflowPublishActivityWorkflowLike | null;
  activeBinding?: WorkflowLogsSurfaceBindingItem | null;
  invocationAudit?: PublishedEndpointInvocationListResponse | null;
  selectedInvocationId?: string | null;
  selectedInvocationDetail?: SensitiveAccessGuardedResult<PublishedEndpointInvocationDetailResponse>;
  buildInvocationHref?: (invocationId: string) => string;
  clearInvocationHref?: string | null;
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

function renderRunTraceHandoff({
  workflowId,
  workflowEditorHref,
  callbackWaitingAutomation,
  sandboxReadiness,
  activeRunSummary,
  activeRunDetail,
  executionView,
  evidenceView
}: {
  workflowId: string;
  workflowEditorHref: string;
  callbackWaitingAutomation: CallbackWaitingAutomationCheck;
  sandboxReadiness: SandboxReadinessCheck | null;
  activeRunSummary: WorkflowLogsSurfaceRunItem | null;
  activeRunDetail: RunDetail | null;
  executionView: RunExecutionView | null;
  evidenceView: RunEvidenceView | null;
}) {
  if (activeRunDetail) {
    return (
      <div data-component="workflow-logs-run-handoff">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Run trace handoff</p>
            <h2>Execution / evidence continuation</h2>
          </div>
          <p className="section-copy">
            当前 invocation 已关联到具体 run，继续复用同一份 execution / evidence facts
            下钻，而不是在 workflow 壳层重造第二套 trace 语义。
          </p>
        </div>

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
      </div>
    );
  }

  if (activeRunSummary) {
    return (
      <article className="diagnostic-panel" data-component="workflow-logs-run-handoff-empty">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Run trace handoff</p>
            <h2>Run detail 暂不可用</h2>
          </div>
          <p className="section-copy">
            当前 invocation 已关联 run {activeRunSummary.id}，但 run detail payload 还没拿到；保留直接
            跳转到完整 run diagnostics 的入口，避免在 workflow 壳层输出不完整 trace。
          </p>
        </div>

        <div className="section-actions">
          <Link className="activity-link" href={activeRunSummary.detailHref}>
            打开完整 run 诊断
          </Link>
          <Link className="inline-link secondary" href={workflowEditorHref}>
            回到编排编辑器
          </Link>
        </div>
      </article>
    );
  }

  return (
    <article className="diagnostic-panel" data-component="workflow-logs-run-handoff-empty">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Run trace handoff</p>
          <h2>当前 invocation 暂无 run 关联</h2>
        </div>
        <p className="section-copy">
          当前 published invocation 还没有可继续下钻的 run trace；先保留 invocation detail 作为当前事实源。
        </p>
      </div>

      <div className="section-actions">
        <Link className="activity-link" href={workflowEditorHref}>
          回到编排编辑器
        </Link>
      </div>
    </article>
  );
}

function renderRunFallbackSurface({
  workflowId,
  recentRuns,
  selectionNotice,
  activeRunSummary,
  activeRunDetail,
  selectionSource,
  publishHref,
  runLibraryHref,
  workflowEditorHref,
  callbackWaitingAutomation,
  sandboxReadiness,
  executionView,
  evidenceView
}: {
  workflowId: string;
  recentRuns: WorkflowLogsSurfaceRunItem[];
  selectionNotice: string | null;
  activeRunSummary: WorkflowLogsSurfaceRunItem | null;
  activeRunDetail: RunDetail | null;
  selectionSource: WorkflowLogsSelectionSource;
  publishHref: string;
  runLibraryHref: string;
  workflowEditorHref: string;
  callbackWaitingAutomation: CallbackWaitingAutomationCheck;
  sandboxReadiness: SandboxReadinessCheck | null;
  executionView: RunExecutionView | null;
  evidenceView: RunEvidenceView | null;
}) {
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
    <>
      <section
        className="workspace-panel workflow-api-surface-header-panel"
        data-component="workflow-logs-run-fallback"
      >
        <div className="workspace-surface-header">
          <div className="workspace-surface-copy workspace-copy-wide">
            <p className="workflow-studio-placeholder-eyebrow">Run trace fallback</p>
            <h2>日志与标注</h2>
            <p>
              当前 workflow 还没有可读的 published invocation 列表，因此页面诚实回退到 workflow recent
              runs、run detail 与 execution / evidence view，先保住排障主链。
            </p>
          </div>
          <div className="workspace-surface-actions workflow-api-surface-actions">
            <Link className="workflow-studio-secondary-link" href={publishHref}>
              查看发布治理
            </Link>
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
              <h2>Workflow scoped run fallback</h2>
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
                  <p className="event-run">events {run.eventCount}</p>
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

      {renderRunTraceHandoff({
        workflowId,
        workflowEditorHref,
        callbackWaitingAutomation,
        sandboxReadiness,
        activeRunSummary,
        activeRunDetail,
        executionView,
        evidenceView
      })}
    </>
  );
}

export function WorkflowLogsSurface({
  workflowId,
  workflow = null,
  activeBinding = null,
  invocationAudit = null,
  selectedInvocationId = null,
  selectedInvocationDetail = null,
  buildInvocationHref,
  clearInvocationHref = null,
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
  const invocationItems = invocationAudit?.items ?? [];
  const activeInvocationItem =
    invocationItems.find((item) => item.id === selectedInvocationId) ?? invocationItems[0] ?? null;
  const activeInvocationHref =
    selectedInvocationId && buildInvocationHref ? buildInvocationHref(selectedInvocationId) : null;
  const selectedInvocationSurface = resolveWorkflowPublishSelectedInvocationDetailSurface({
    selectedInvocationId,
    selectedInvocationDetail,
    currentHref: activeInvocationHref,
    callbackWaitingAutomation,
    sandboxReadiness
  });

  if (invocationItems.length === 0 && recentRuns.length === 0) {
    return (
      <div
        className="workspace-panel workflow-logs-empty-state"
        data-component="workflow-logs-empty-state"
      >
        <p className="workflow-studio-placeholder-eyebrow">Invocation and run facts</p>
        <h2>日志与标注</h2>
        <p>
          当前 workflow 还没有 recent published invocations 或 recent runs；请先从编辑器调试或发布入口触发一次运行，再回来查看 invocation / execution / evidence 追溯。
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

  if (invocationItems.length === 0) {
    return (
      <div
        className="workflow-logs-surface"
        data-component="workflow-logs-surface"
        data-selection-source={selectionSource}
      >
        {renderRunFallbackSurface({
          workflowId,
          recentRuns,
          selectionNotice,
          activeRunSummary,
          activeRunDetail,
          selectionSource,
          publishHref,
          runLibraryHref,
          workflowEditorHref,
          callbackWaitingAutomation,
          sandboxReadiness,
          executionView,
          evidenceView
        })}
      </div>
    );
  }

  const selectedInvocationDetailValue =
    selectedInvocationSurface.kind === "ok" ? selectedInvocationSurface.detail : null;
  const selectedInvocationStatus =
    selectedInvocationDetailValue?.invocation.status ?? activeInvocationItem?.status ?? "unknown";
  const selectedInvocationRunId =
    selectedInvocationDetailValue?.run?.id ??
    selectedInvocationDetailValue?.invocation.run_id ??
    activeInvocationItem?.run_id ??
    activeRunSummary?.id ??
    null;

  return (
    <div
      className="workflow-logs-surface"
      data-component="workflow-logs-surface"
      data-selection-source={selectionSource}
    >
      <section className="workspace-panel workflow-api-surface-header-panel">
        <div className="workspace-surface-header">
          <div className="workspace-surface-copy workspace-copy-wide">
            <p className="workflow-studio-placeholder-eyebrow">Published invocation facts</p>
            <h2>日志与标注</h2>
            <p>
              当前页面优先围绕 workflow-scoped published invocations 组织排障：先在左侧选择请求，再在右侧查看 invocation detail，并顺着 run trace 继续下钻。
            </p>
          </div>
          <div className="workspace-surface-actions workflow-api-surface-actions">
            <Link className="workflow-studio-secondary-link" href={publishHref}>
              查看发布治理
            </Link>
            <Link className="workflow-studio-secondary-link" href={runLibraryHref}>
              打开全局 run 列表
            </Link>
          </div>
        </div>

        <div className="workspace-overview-strip">
          <article className="workspace-stat-card workspace-stat-card-wide">
            <span>Binding</span>
            <strong>{activeBinding?.endpointAlias ?? activeBinding?.routePath ?? "N/A"}</strong>
            <p className="workspace-stat-copy">
              {activeBinding ? `${activeBinding.protocol} · ${activeBinding.authMode}` : "当前没有 active binding"}
            </p>
          </article>
          <article className="workspace-stat-card">
            <span>Recent invocations</span>
            <strong>{invocationAudit?.summary.total_count ?? invocationItems.length}</strong>
          </article>
          <article className="workspace-stat-card">
            <span>Current focus</span>
            <strong>{selectedInvocationId ?? activeInvocationItem?.id ?? "N/A"}</strong>
            <p className="workspace-stat-copy">status: {selectedInvocationStatus}</p>
          </article>
          <article className="workspace-stat-card">
            <span>Last invoked</span>
            <strong>
              {formatTimestamp(
                invocationAudit?.summary.last_invoked_at ?? activeInvocationItem?.created_at ?? null
              )}
            </strong>
          </article>
          <article className="workspace-stat-card workspace-stat-card-wide">
            <span>Run trace</span>
            <strong>{selectedInvocationRunId ?? "当前 invocation 暂无 run"}</strong>
            <p className="workspace-stat-copy">
              selection: {selectionSource === "latest" ? "latest invocation" : selectionSource}
            </p>
          </article>
        </div>
      </section>

      <section className="diagnostics-layout">
        <article className="diagnostic-panel" data-component="workflow-logs-invocation-list">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Published invocations</p>
              <h2>Workflow scoped request list</h2>
            </div>
            <p className="section-copy">
              只展示当前 workflow binding 最近的 published invocations，避免作者在日志页误读跨 workflow 或跨 surface 的请求事实。
            </p>
          </div>

          {selectionNotice ? <p className="section-copy">{selectionNotice}</p> : null}

          <div className="activity-list">
            {invocationItems.map((item) => (
              <WorkflowPublishInvocationEntryCard
                key={item.id}
                item={item}
                detailHref={buildInvocationHref ? buildInvocationHref(item.id) : activeInvocationHref ?? "#"}
                detailActive={item.id === (selectedInvocationId ?? activeInvocationItem?.id ?? null)}
                hideRecommendedNextStep
                callbackWaitingAutomation={callbackWaitingAutomation}
                sandboxReadiness={sandboxReadiness}
              />
            ))}
          </div>
        </article>

        <article className="diagnostic-panel" data-component="workflow-logs-invocation-detail">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Current invocation</p>
              <h2>Invocation detail and operator handoff</h2>
            </div>
            <p className="section-copy">
              当前焦点详情继续复用 publish activity detail payload；如果已关联 run，就在同页保留 execution / evidence 的继续下钻入口。
            </p>
          </div>

          {selectedInvocationSurface.kind === "ok" && clearInvocationHref ? (
            <WorkflowPublishInvocationDetailPanel
              detail={selectedInvocationSurface.detail}
              workflow={workflow}
              clearHref={clearInvocationHref}
              currentHref={activeInvocationHref}
              tools={[]}
              callbackWaitingAutomation={callbackWaitingAutomation}
              sandboxReadiness={sandboxReadiness}
              selectedNextStepSurface={selectedInvocationSurface.nextStepSurface}
            />
          ) : selectedInvocationSurface.kind === "blocked" ? (
            <div className="payload-card">
              <div className="payload-card-header">
                <span className="status-meta">{selectedInvocationSurface.blockedSurfaceCopy.title}</span>
              </div>
              <p>{selectedInvocationSurface.blockedSurfaceCopy.summary}</p>
            </div>
          ) : selectedInvocationSurface.kind === "unavailable" ? (
            <div className="payload-card">
              <div className="payload-card-header">
                <span className="status-meta">{selectedInvocationSurface.unavailableSurfaceCopy.title}</span>
              </div>
              <p>{selectedInvocationSurface.unavailableSurfaceCopy.summary}</p>
              <p className="section-copy">{selectedInvocationSurface.unavailableSurfaceCopy.detail}</p>
            </div>
          ) : (
            <p className="empty-state">
              当前还没有选中的 invocation detail；请先从左侧列表选择一条 published invocation。
            </p>
          )}
        </article>
      </section>

      {renderRunTraceHandoff({
        workflowId,
        workflowEditorHref,
        callbackWaitingAutomation,
        sandboxReadiness,
        activeRunSummary,
        activeRunDetail,
        executionView,
        evidenceView
      })}
    </div>
  );
}
