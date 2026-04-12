import { Button, Card } from 'antd';
import { useNavigate } from '@tanstack/react-router';

import {
  contracts,
  embedRuntimeSnapshot,
  embeddedArtifacts,
  getRun,
  overviewRunSummaries,
  repoReality,
  summaryStats,
  workspaceMeta
} from '../../../data/workspace-data';
import { useWorkspaceStore } from '../../../state/workspace-store';
import { SummaryStats } from '../components/SummaryStats';
import { StatusBadge } from '../components/StatusBadge';

export function OverviewView() {
  const navigate = useNavigate();
  const openRun = useWorkspaceStore((state) => state.openRun);
  const setRunFilter = useWorkspaceStore((state) => state.setRunFilter);

  return (
    <section className="view-stack">
      <Card className="hero-card" variant="borderless">
        <div className="hero-layout">
          <div>
            <p className="section-label">应用概览</p>
            <h2>{workspaceMeta.name} workspace demo</h2>
            <p className="hero-copy">
              当前 published contract 已在跑 live traffic；Classifier、Approval gate
              与 Reply composer 还有 3 个 draft changes，embedded runtime 仍停留在
              shell only 阶段。
            </p>
            <div className="action-row">
              <Button
                type="primary"
                onClick={() => {
                  void navigate({ to: '/orchestration' });
                }}
              >
                进入编排
              </Button>
            </div>
          </div>

          <div className="hero-side">
            <StatusBadge
              status="published"
              label={`Published ${workspaceMeta.publishedVersion}`}
            />
            <StatusBadge status="healthy" label="Runtime healthy" />
            <p className="sidebar-copy">
              概览页只保留当前状态、最近运行摘要和下一跳；完整契约、日志细节与节点编辑都回到各自任务域。
            </p>
          </div>
        </div>
      </Card>

      <SummaryStats items={summaryStats} />

      <div className="content-grid content-grid-overview">
        <Card
          className="panel"
          title={<span role="heading" aria-level={2}>最近运行摘要</span>}
        >
          <div className="stack-list">
            {overviewRunSummaries.map((item) => {
              const run = getRun(item.runId);

              if (!run) {
                return null;
              }

              return (
                <article key={run.id} className="stack-row">
                  <div>
                    <div className="badge-row">
                      <StatusBadge status={run.status} label={run.statusLabel} />
                      <span className="meta-chip">{run.currentNode}</span>
                    </div>
                    <strong>{run.title}</strong>
                    <p>{item.note}</p>
                  </div>
                  <Button
                    onClick={() => {
                      setRunFilter(run.status);
                      openRun(run.id);
                      void navigate({ to: '/logs' });
                    }}
                  >
                    {item.actionLabel}
                  </Button>
                </article>
              );
            })}
          </div>
        </Card>

        <Card className="panel" title="Published 与 Draft 明确分层">
          <div className="stack-list">
            <article className="stack-row">
              <div>
                <strong>Published contract</strong>
                <p>{contracts.openai.draftNote}</p>
              </div>
              <StatusBadge
                status={contracts.openai.status}
                label={contracts.openai.statusLabel}
              />
            </article>
            <article className="stack-row">
              <div>
                <strong>Current draft</strong>
                <p>
                  Classifier 阈值、Approval gate 文案与 Reply composer 输出仍等待下一次发布。
                </p>
              </div>
              <StatusBadge status="draft" label="3 changes" />
            </article>
          </div>
        </Card>

        <Card className="panel" title="真实路由成熟度">
          <div className="stack-list">
            {repoReality.map((item) => (
              <article key={item.title} className="stack-row">
                <div>
                  <strong>{item.title}</strong>
                  <p>{item.note}</p>
                </div>
                <StatusBadge status={item.status} label={item.statusLabel} />
              </article>
            ))}
          </div>
        </Card>

        <Card className="panel" title="Embedded runtime snapshot">
          <div className="stack-list">
            {embeddedArtifacts.map((artifact) => (
              <article key={artifact.appId} className="stack-row">
                <div>
                  <strong>{artifact.name}</strong>
                  <p>
                    {artifact.routePrefix} · {artifact.version}
                  </p>
                </div>
                <StatusBadge status="draft" label="Manifest staged" />
              </article>
            ))}
          </div>

          <div className="info-block">
            <h3>Host context</h3>
            <p>
              {embedRuntimeSnapshot.applicationId} · {embedRuntimeSnapshot.teamId}
            </p>
          </div>
        </Card>
      </div>
    </section>
  );
}
