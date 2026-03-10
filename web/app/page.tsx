import Link from "next/link";

import { syncAdapterTools } from "@/app/actions";
import { AdapterSyncForm } from "@/components/adapter-sync-form";
import { StatusCard } from "@/components/status-card";
import { getSystemOverview } from "@/lib/get-system-overview";
import {
  formatCountMap,
  formatTimestamp
} from "@/lib/runtime-presenters";

const highlights = [
  "Dify 风格的本地源码开发路径",
  "FastAPI + Celery 运行时骨架",
  "Docker 中间件环境与全容器模式并存"
];

export default async function HomePage() {
  const overview = await getSystemOverview();
  const recentRuns = overview.runtime_activity.recent_runs;
  const activitySummary = overview.runtime_activity.summary;
  const latestRun = recentRuns[0];

  return (
    <main className="shell">
      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">7Flows Studio</p>
          <h1>为多 Agent 工作流准备的丝滑起步架构</h1>
          <p className="hero-text">
            当前首页已经接上后端概览接口，用来直观看到中间件、运行时与对象存储是否就绪。
            现在也会把 compat adapter、工具目录同步结果和运行摘要一起展示出来，详细日志则进入独立的
            run 诊断面板查看。
          </p>
          <div className="pill-row">
            {highlights.map((item) => (
              <span className="pill" key={item}>
                {item}
              </span>
            ))}
          </div>
        </div>
        <div className="hero-panel">
          <div className="panel-label">Environment</div>
          <div className="panel-value">{overview.environment}</div>
          <p className="panel-text">
            API 状态：<strong>{overview.status}</strong>
          </p>
          <p className="panel-text">已声明能力：{overview.capabilities.join(" / ")}</p>
          <dl className="signal-list">
            <div>
              <dt>Adapters</dt>
              <dd>{overview.plugin_adapters.length}</dd>
            </div>
            <div>
              <dt>Tools</dt>
              <dd>{overview.plugin_tools.length}</dd>
            </div>
            <div>
              <dt>Recent events</dt>
              <dd>{activitySummary.recent_event_count}</dd>
            </div>
          </dl>
        </div>
      </section>

      <section className="grid">
        {overview.services.map((service) => (
          <StatusCard key={service.name} service={service} />
        ))}
      </section>

      <section className="diagnostics-layout">
        <article className="diagnostic-panel">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Compatibility</p>
              <h2>Adapter health and sync</h2>
            </div>
            <p className="section-copy">
              在这里可以看到 compat adapter 当前是否可达，并把 discovery 工具目录同步到
              API 运行时注册表。
            </p>
          </div>

          <div className="diagnostic-list">
            {overview.plugin_adapters.length === 0 ? (
              <p className="empty-state">当前还没有启用中的 compat adapter。</p>
            ) : (
              overview.plugin_adapters.map((adapter) => (
                <article className="adapter-card" key={adapter.id}>
                  <div className="adapter-header">
                    <div>
                      <p className="status-meta">Adapter</p>
                      <h3>{adapter.id}</h3>
                    </div>
                    <span className={`health-pill ${adapter.status}`}>
                      {adapter.status}
                    </span>
                  </div>
                  <p className="adapter-endpoint">{adapter.endpoint}</p>
                  <p className="adapter-copy">
                    {adapter.detail ??
                      "目录同步会调用 adapter 的 /tools，并把返回结果注册为 compat 工具。"}
                  </p>
                  <AdapterSyncForm adapterId={adapter.id} action={syncAdapterTools} />
                </article>
              ))
            )}
          </div>
        </article>

        <article className="diagnostic-panel">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Catalog</p>
              <h2>Plugin tool registry</h2>
            </div>
            <p className="section-copy">
              这里展示 API 当前已知的工具目录，便于确认 discovery/sync 是否真的生效。
            </p>
          </div>

          <div className="tool-list">
            {overview.plugin_tools.length === 0 ? (
              <p className="empty-state">尚未同步任何 compat 工具。</p>
            ) : (
              overview.plugin_tools.map((tool) => (
                <article className="tool-row" key={tool.id}>
                  <div>
                    <h3>{tool.name}</h3>
                    <p>{tool.id}</p>
                  </div>
                  <dl>
                    <div>
                      <dt>Ecosystem</dt>
                      <dd>{tool.ecosystem}</dd>
                    </div>
                    <div>
                      <dt>Source</dt>
                      <dd>{tool.source}</dd>
                    </div>
                    <div>
                      <dt>Callable</dt>
                      <dd>{tool.callable ? "yes" : "no"}</dd>
                    </div>
                  </dl>
                </article>
              ))
            )}
          </div>
        </article>
      </section>

      <section className="diagnostics-layout runtime-layout">
        <article className="diagnostic-panel">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Runtime</p>
              <h2>Recent runs</h2>
            </div>
            <p className="section-copy">
              使用运行态记录快速确认最近有没有真实执行，以及每个 run 留下了多少事件。
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
              <p className="empty-state">还没有历史 run，可先通过运行接口触发一次工作流执行。</p>
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
                  <Link className="activity-link" href={`/runs/${run.id}`}>
                    查看 run 诊断面板
                  </Link>
                </article>
              ))
            )}
          </div>
        </article>

        <article className="diagnostic-panel">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Run Events</p>
              <h2>Event spine overview</h2>
            </div>
            <p className="section-copy">
              调试、流式输出和回放都会复用同一条 run events 事件流；首页只保留聚合信号，
              详细 payload 和节点级日志统一回到独立 run 诊断面板。
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

          <div className="summary-strip">
            <article className="summary-card">
              <span>Recent events</span>
              <strong>{activitySummary.recent_event_count}</strong>
            </article>
            <article className="summary-card">
              <span>Event types</span>
              <strong>{Object.keys(activitySummary.event_types).length}</strong>
            </article>
          </div>

          <div className="entry-card">
            <p className="entry-card-title">详细日志查看</p>
            <p className="section-copy entry-copy">
              从最近 run 进入独立诊断页后，可以继续看节点输入输出、错误信息和完整事件 payload。
            </p>
            {latestRun ? (
              <Link className="inline-link" href={`/runs/${latestRun.id}`}>
                打开最新 run 诊断面板
              </Link>
            ) : (
              <p className="empty-state compact">当前还没有可打开的 run 诊断记录。</p>
            )}
          </div>
        </article>
      </section>

      <section className="roadmap">
        <div>
          <p className="eyebrow">Signal Discipline</p>
          <h2>测试结果与应用日志都应该是可见的开发信号</h2>
          <p className="hero-text">
            目录同步、服务健康和运行事件已经接入首页诊断区。后续继续推进时，会沿着同一条思路把
            验证结果、调试信息和用户可优化的运行日志保持在可追踪、可复用的位置上。
          </p>
        </div>
        <ul className="roadmap-list">
          <li>让 compat 工具同步结果进入持久化存储与重启恢复</li>
          <li>把更多调试信息继续统一收敛到 run events</li>
          <li>继续扩展独立 run 诊断面板与发布诊断视图</li>
          <li>继续保持每轮开发的验证结果和开发记录留痕</li>
        </ul>
      </section>
    </main>
  );
}
