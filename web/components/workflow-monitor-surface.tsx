import React from "react";
import Link from "next/link";

import { OperatorRunSampleCardList } from "@/components/operator-run-sample-card-list";
import { WorkflowPublishTrafficTimeline } from "@/components/workflow-publish-traffic-timeline";
import type { PublishedEndpointInvocationListResponse, WorkflowPublishedEndpointItem } from "@/lib/get-workflow-publish";
import { buildRunDetailHref } from "@/lib/workbench-links";
import { buildWorkflowMonitorSurfaceModel } from "@/lib/workflow-monitor-surface";

type WorkflowMonitorSurfaceProps = {
  workflowId: string;
  bindings: WorkflowPublishedEndpointItem[];
  invocationAuditsByBinding: Record<string, PublishedEndpointInvocationListResponse | null>;
  publishHref: string;
  logsHref: string;
  workflowEditorHref: string;
  currentHref: string;
};

export function WorkflowMonitorSurface({
  workflowId,
  bindings,
  invocationAuditsByBinding,
  publishHref,
  logsHref,
  workflowEditorHref,
  currentHref,
}: WorkflowMonitorSurfaceProps) {
  const model = buildWorkflowMonitorSurfaceModel({
    bindings,
    invocationAuditsByBinding,
    resolveWorkflowDetailHref: () => workflowEditorHref,
  });
  const hasDraftBindings = bindings.some((binding) => binding.lifecycle_status === "draft");

  if (model.publishedBindings.length === 0) {
    return (
      <div
        className="workspace-panel workflow-api-empty-state"
        data-component="workflow-monitor-empty-state"
      >
        <p className="workflow-studio-placeholder-eyebrow">Workflow monitor</p>
        <h2>监测报表</h2>
        <p>
          {hasDraftBindings
            ? "当前 workflow 只有 draft / offline publish definition；请先完成发布治理，再回来查看 invocation timeline、follow-up 和 backlog 信号。"
            : "当前 workflow 还没有 published binding；监测页不会伪造流量或报表，请先完成发布治理再回来查看真实调用事实。"}
        </p>
        <div className="workflow-studio-placeholder-actions">
          <Link className="workflow-studio-secondary-link" href={publishHref}>
            前往发布治理
          </Link>
          <Link className="workflow-studio-secondary-link" href={logsHref}>
            查看 workflow 日志
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="workflow-monitor-surface" data-component="workflow-monitor-surface">
      <section className="workspace-panel workflow-api-surface-header-panel">
        <div className="workspace-surface-header">
          <div className="workspace-surface-copy workspace-copy-wide">
            <p className="workflow-studio-placeholder-eyebrow">Workflow monitor</p>
            <h2>监测报表</h2>
            <p>
              当前页面直接把 published invocation、traffic timeline 和 sampled run follow-up
              接回 workflow 壳层，方便作者在同一路由里判断真实流量、待跟进事项和最近的运行信号。
            </p>
          </div>
          <div className="workspace-surface-actions workflow-api-surface-actions">
            <Link className="workflow-studio-secondary-link" href={publishHref}>
              前往发布治理
            </Link>
            <Link className="workflow-studio-secondary-link" href={logsHref}>
              打开 workflow 日志
            </Link>
          </div>
        </div>

        <div className="summary-strip" data-component="workflow-monitor-summary-strip">
          {model.summaryCards.map((card) => (
            <article className="summary-card" key={card.key}>
              <span>{card.label}</span>
              <strong>{card.value}</strong>
              {card.detail ? <p className="binding-meta">{card.detail}</p> : null}
            </article>
          ))}
        </div>
      </section>

      <section className="workflow-studio-surface workflow-studio-surface-utility" data-surface="monitor">
        <article className="diagnostic-panel" data-component="workflow-monitor-primary-follow-up">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Primary follow-up</p>
              <h2>Backlog signal</h2>
            </div>
            <p className="section-copy">
              优先看当前 workflow 在 publish / invocation 事实上的第一阻塞项，避免只盯单条 run
              而忽略共享 backlog。
            </p>
          </div>
          <div className="payload-card compact-card">
            <div className="payload-card-header">
              <span className="status-meta">Summary focus</span>
              <span className={`health-pill ${model.primaryFollowUp.tone === "healthy" ? "healthy" : "pending"}`}>
                {model.primaryFollowUp.tone === "healthy" ? "clear" : "attention"}
              </span>
            </div>
            <p className="binding-meta">{model.primaryFollowUp.headline}</p>
            <p className="section-copy entry-copy">{model.primaryFollowUp.detail}</p>
          </div>
        </article>

        {!model.hasInvocationFacts ? (
          <article className="diagnostic-panel" data-component="workflow-monitor-no-traffic-state">
            <div className="section-heading">
              <div>
                <p className="eyebrow">No live traffic yet</p>
                <h2>还没有 invocation / follow-up 样本</h2>
              </div>
              <p className="section-copy">
                当前 workflow 已有 published binding，但监测页暂时还没有足够的调用样本。先从发布治理确认 endpoint 已对外暴露，再到日志页查看第一批 run。
              </p>
            </div>
            <div className="section-actions">
              <Link className="activity-link" href={publishHref}>
                回到发布治理
              </Link>
              <Link className="inline-link secondary" href={logsHref}>
                打开 workflow 日志
              </Link>
            </div>
          </article>
        ) : null}

        <WorkflowPublishTrafficTimeline
          timeline={model.timeline}
          timelineGranularity={model.timelineGranularity}
          timeWindowLabel={model.timeWindowLabel}
        />

        {model.sampledRunCards.length > 0 ? (
          <section className="diagnostic-panel" data-component="workflow-monitor-sampled-runs">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Sampled follow-up</p>
                <h2>Recent run follow-up samples</h2>
              </div>
              <p className="section-copy">
                只展示 monitor 当前时间窗里已经回接到 publish invocation 的 sampled run，方便在 workflow 壳层里快速看到 callback waiting、execution focus 和治理缺口。
              </p>
            </div>
            <OperatorRunSampleCardList
              cards={model.sampledRunCards}
              currentHref={currentHref}
              resolveRunDetailHref={buildRunDetailHref}
              skillTraceDescription={`workflow ${workflowId} monitor sample 继续复用 canonical skill trace。`}
            />
          </section>
        ) : model.hasInvocationFacts ? (
          <article className="diagnostic-panel" data-component="workflow-monitor-follow-up-empty-state">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Follow-up samples</p>
                <h2>当前时间窗还没有 sampled run</h2>
              </div>
              <p className="section-copy">
                timeline 已经有 invocation 事实，但当前列表还没有回接到 sampled run 快照；继续到日志页查看 workflow recent runs，可以拿到更细的 execution / evidence 细节。
              </p>
            </div>
            <div className="section-actions">
              <Link className="activity-link" href={logsHref}>
                查看 workflow 日志
              </Link>
              <Link className="inline-link secondary" href={workflowEditorHref}>
                回到编排编辑器
              </Link>
            </div>
          </article>
        ) : null}
      </section>
    </div>
  );
}
