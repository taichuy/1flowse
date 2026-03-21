import type { Metadata } from "next";
import Link from "next/link";

import { WorkbenchEntryLinks } from "@/components/workbench-entry-links";
import { getSystemOverview } from "@/lib/get-system-overview";
import { formatCountMap, formatTimestamp } from "@/lib/runtime-presenters";

export const metadata: Metadata = {
  title: "Runs | 7Flows Studio"
};

export default async function RunsPage() {
  const overview = await getSystemOverview();
  const recentRuns = overview.runtime_activity.recent_runs;
  const activitySummary = overview.runtime_activity.summary;
  const latestRun = recentRuns[0] ?? null;

  return (
    <main className="page-shell workspace-page">
      <section className="hero-card">
        <div>
          <p className="eyebrow">Run library</p>
          <h1>运行诊断入口收口到独立列表</h1>
          <p className="hero-copy">
            首页和 operator 面板只保留摘要；从这里继续进入独立 run 诊断页、回到 workflow 编辑器，或沿着同一条执行事实继续排障。
          </p>
        </div>
        <WorkbenchEntryLinks
          keys={["operatorInbox", "workflowLibrary", "home"]}
          overrides={{
            operatorInbox: {
              label: "回到 sensitive access inbox"
            }
          }}
        />
      </section>

      <section className="diagnostics-layout runtime-layout">
        <article className="diagnostic-panel panel-span">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Recent runs</p>
              <h2>统一 run 事实入口</h2>
            </div>
            <p className="section-copy">
              这里直接复用 system overview 的最近执行摘要，避免 operator 从阻断收件箱跳出后落到不存在的 runs 路由。
            </p>
          </div>

          <div className="summary-strip">
            <article className="summary-card">
              <span>Recent runs</span>
              <strong>{activitySummary.recent_run_count}</strong>
            </article>
            <article className="summary-card">
              <span>Recent events</span>
              <strong>{activitySummary.recent_event_count}</strong>
            </article>
            <article className="summary-card">
              <span>Run statuses</span>
              <strong>{formatCountMap(activitySummary.run_statuses)}</strong>
            </article>
          </div>

          <div className="activity-list">
            {recentRuns.length === 0 ? (
              <div className="empty-state-block">
                <p className="empty-state">当前还没有历史 run，可先从 workflow 编辑器触发一次执行。</p>
                <Link className="inline-link" href="/workflows">
                  打开 workflow 列表
                </Link>
              </div>
            ) : (
              recentRuns.map((run) => (
                <article className="activity-row" key={run.id}>
                  <div className="activity-header">
                    <div>
                      <h3>{run.workflow_id}</h3>
                      <p>
                        run {run.id} · version {run.workflow_version}
                      </p>
                    </div>
                    <span className={`health-pill ${run.status}`}>{run.status}</span>
                  </div>
                  <p className="activity-copy">
                    Created {formatTimestamp(run.created_at)} · events {run.event_count}
                  </p>
                  <div className="section-actions">
                    <Link className="activity-link" href={`/runs/${encodeURIComponent(run.id)}`}>
                      查看 run 诊断面板
                    </Link>
                    <Link
                      className="inline-link secondary"
                      href={`/workflows/${encodeURIComponent(run.workflow_id)}`}
                    >
                      回到 workflow 编辑器
                    </Link>
                  </div>
                </article>
              ))
            )}
          </div>
        </article>

        <article className="diagnostic-panel">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Event spine</p>
              <h2>事件流聚合信号</h2>
            </div>
            <p className="section-copy">
              调试、流式输出和 callback waiting follow-up 继续复用同一条 run events 事件脊柱；这里保留聚合信号，详情仍进入具体 run。
            </p>
          </div>

          <div className="event-type-strip">
            {Object.keys(activitySummary.event_types).length === 0 ? (
              <p className="empty-state compact">当前还没有可聚合的事件类型统计。</p>
            ) : (
              Object.entries(activitySummary.event_types).map(([eventType, count]) => (
                <span className="event-chip" key={eventType}>
                  {eventType} · {count}
                </span>
              ))
            )}
          </div>

          <div className="entry-card">
            <p className="entry-card-title">Operator follow-up</p>
            <p className="section-copy entry-copy">
              如果当前阻断来自审批、恢复或通知派发，可以从 runs 列表回到 sensitive access inbox 继续处理 operator 动作。
            </p>
            <WorkbenchEntryLinks
              keys={["operatorInbox", "workflowLibrary"]}
              overrides={{
                operatorInbox: {
                  label: "打开 sensitive access inbox"
                }
              }}
              primaryKey="operatorInbox"
              variant="inline"
            />
            {latestRun ? (
              <Link className="inline-link secondary" href={`/runs/${encodeURIComponent(latestRun.id)}`}>
                打开最新 run 诊断面板
              </Link>
            ) : null}
          </div>
        </article>
      </section>
    </main>
  );
}
