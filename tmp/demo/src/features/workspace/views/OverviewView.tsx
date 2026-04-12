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
  const waitingRun = getRun('run_2048');

  const openOverviewRun = (runId: string) => {
    const run = getRun(runId);

    if (!run) {
      return;
    }

    setRunFilter(run.status);
    openRun(run.id);
    void navigate({ to: '/logs' });
  };

  return (
    <section className="view-stack">
      <Card className="hero-card" variant="borderless">
        <div className="hero-layout">
          <div className="hero-main">
            <p className="section-label">应用概览</p>
            <div className="hero-title-row">
              <h2>{workspaceMeta.name}</h2>
              <span className="hero-kicker">Workspace demo</span>
            </div>
            <p className="hero-copy">
              Published 仍在跑 live traffic；3 个 draft node changes 待发；embedded
              runtime 还停留在 shell only。
            </p>
            <div className="action-row overview-actions">
              <Button
                type="primary"
                onClick={() => {
                  void navigate({ to: '/orchestration' });
                }}
              >
                进入编排
              </Button>
              <Button
                onClick={() => {
                  void navigate({ to: '/api' });
                }}
              >
                查看 API 契约
              </Button>
              {waitingRun ? (
                <Button
                  onClick={() => {
                    openOverviewRun(waitingRun.id);
                  }}
                >
                  继续处理等待态
                </Button>
              ) : null}
            </div>
          </div>

          <div className="hero-side">
            <div className="hero-status-row">
              <StatusBadge
                status="published"
                label={`Published ${workspaceMeta.publishedVersion}`}
              />
              <StatusBadge status="healthy" label="Runtime healthy" />
            </div>

            <div className="hero-side-grid">
              <article className="signal-card">
                <p className="section-label">Published surface</p>
                <strong>OpenAI compatible</strong>
                <p>正式入口仍只暴露一个兼容模式。</p>
              </article>
              <article className="signal-card">
                <p className="section-label">Needs attention</p>
                <strong>1 waiting + 1 failed</strong>
                <p>等待态和失败样本都要继续保留。</p>
              </article>
              <article className="signal-card">
                <p className="section-label">Host context</p>
                <strong>{embedRuntimeSnapshot.teamId}</strong>
                <p>{embedRuntimeSnapshot.applicationId} 还没接 live runtime。</p>
              </article>
            </div>
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
                      openOverviewRun(run.id);
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
