import Link from "next/link";

import type { RunDetail } from "@/lib/get-run-detail";
import {
  formatDuration,
  formatJsonPayload,
  formatTimestamp
} from "@/lib/runtime-presenters";

type RunDiagnosticsPanelProps = {
  run: RunDetail;
};

export function RunDiagnosticsPanel({ run }: RunDiagnosticsPanelProps) {
  const eventTypes = summarizeEventTypes(run.events);

  return (
    <main className="shell">
      <section className="hero diagnostic-hero">
        <div className="hero-copy">
          <p className="eyebrow">Run Diagnostics</p>
          <h1>{run.workflow_id}</h1>
          <p className="hero-text">
            这里承接单次 run 的节点状态、输入输出和完整事件流，首页只保留系统摘要和诊断入口。
          </p>
          <div className="pill-row">
            <span className="pill">run {run.id}</span>
            <span className="pill">version {run.workflow_version}</span>
            <span className="pill">{run.node_runs.length} node runs</span>
            <span className="pill">{run.events.length} events</span>
          </div>
          <div className="hero-actions">
            <Link className="inline-link" href="/">
              返回系统首页
            </Link>
          </div>
        </div>
        <div className="hero-panel">
          <div className="panel-label">Run status</div>
          <div className="panel-value">{run.status}</div>
          <p className="panel-text">
            创建时间：<strong>{formatTimestamp(run.created_at)}</strong>
          </p>
          <p className="panel-text">
            执行耗时：<strong>{formatDuration(run.started_at, run.finished_at)}</strong>
          </p>
          <dl className="signal-list">
            <div>
              <dt>Node runs</dt>
              <dd>{run.node_runs.length}</dd>
            </div>
            <div>
              <dt>Events</dt>
              <dd>{run.events.length}</dd>
            </div>
            <div>
              <dt>Errors</dt>
              <dd>{countErroredNodes(run)}</dd>
            </div>
          </dl>
        </div>
      </section>

      <section className="diagnostics-layout runtime-layout">
        <article className="diagnostic-panel">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Envelope</p>
              <h2>Run summary</h2>
            </div>
            <p className="section-copy">
              先看这次执行的总状态、起止时间和输入输出，再往下钻到节点和事件级细节。
            </p>
          </div>

          <div className="summary-strip">
            <article className="summary-card">
              <span>Status</span>
              <strong>{run.status}</strong>
            </article>
            <article className="summary-card">
              <span>Started</span>
              <strong>{formatTimestamp(run.started_at)}</strong>
            </article>
            <article className="summary-card">
              <span>Finished</span>
              <strong>{formatTimestamp(run.finished_at)}</strong>
            </article>
            <article className="summary-card">
              <span>Duration</span>
              <strong>{formatDuration(run.started_at, run.finished_at)}</strong>
            </article>
          </div>

          <div className="detail-grid">
            <PayloadCard title="Trigger input" payload={run.input_payload} />
            <PayloadCard
              title="Run output"
              payload={run.output_payload}
              emptyCopy="当前还没有最终输出。"
            />
          </div>

          {run.error_message ? (
            <div className="payload-card">
              <div className="payload-card-header">
                <span className="status-meta">Run error</span>
              </div>
              <pre>{run.error_message}</pre>
            </div>
          ) : null}
        </article>

        <article className="diagnostic-panel">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Events</p>
              <h2>Run event overview</h2>
            </div>
            <p className="section-copy">
              事件类型分布和完整事件流共用同一批 run events，不再把详细日志堆回首页。
            </p>
          </div>

          <div className="event-type-strip">
            {Object.keys(eventTypes).length === 0 ? (
              <p className="empty-state compact">当前没有事件类型可统计。</p>
            ) : (
              Object.entries(eventTypes).map(([eventType, count]) => (
                <span className="event-chip" key={eventType}>
                  {eventType} · {count}
                </span>
              ))
            )}
          </div>

          <div className="meta-grid">
            <article className="summary-card">
              <span>First event</span>
              <strong>{formatTimestamp(run.events[0]?.created_at)}</strong>
            </article>
            <article className="summary-card">
              <span>Last event</span>
              <strong>{formatTimestamp(run.events.at(-1)?.created_at)}</strong>
            </article>
          </div>
        </article>
      </section>

      <section className="diagnostics-layout">
        <article className="diagnostic-panel">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Nodes</p>
              <h2>Node execution timeline</h2>
            </div>
            <p className="section-copy">
              每个节点都保留自己的输入、输出、状态和错误信息，方便直接定位执行链路。
            </p>
          </div>

          <div className="timeline-list">
            {run.node_runs.length === 0 ? (
              <p className="empty-state">当前 run 还没有节点执行记录。</p>
            ) : (
              run.node_runs.map((nodeRun) => (
                <article className="timeline-row" key={nodeRun.id}>
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
                  <p className="activity-copy">
                    Started {formatTimestamp(nodeRun.started_at)} · Finished{" "}
                    {formatTimestamp(nodeRun.finished_at)} · Duration{" "}
                    {formatDuration(nodeRun.started_at, nodeRun.finished_at)}
                  </p>
                  {nodeRun.error_message ? (
                    <p className="run-error-message">{nodeRun.error_message}</p>
                  ) : null}
                  <div className="detail-grid">
                    <PayloadCard title="Input" payload={nodeRun.input_payload} />
                    <PayloadCard
                      title="Output"
                      payload={nodeRun.output_payload}
                      emptyCopy="当前没有节点输出。"
                    />
                  </div>
                </article>
              ))
            )}
          </div>
        </article>

        <article className="diagnostic-panel">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Log spine</p>
              <h2>Full run events</h2>
            </div>
            <p className="section-copy">
              这里展示这次 run 的完整事件流和 payload；首页只保留聚合信号和跳转入口。
            </p>
          </div>

          <div className="event-list">
            {run.events.length === 0 ? (
              <p className="empty-state">当前 run 还没有事件流记录。</p>
            ) : (
              run.events.map((event) => (
                <article className="event-row" key={event.id}>
                  <div className="event-meta">
                    <span>{event.event_type}</span>
                    <span>{formatTimestamp(event.created_at)}</span>
                  </div>
                  <p className="event-run">run {event.run_id}</p>
                  {event.node_run_id ? (
                    <p className="event-run">node run {event.node_run_id}</p>
                  ) : null}
                  <pre>{formatJsonPayload(event.payload)}</pre>
                </article>
              ))
            )}
          </div>
        </article>
      </section>
    </main>
  );
}

function PayloadCard({
  title,
  payload,
  emptyCopy = "当前没有可展示的数据。"
}: {
  title: string;
  payload: unknown;
  emptyCopy?: string;
}) {
  const isEmptyObject =
    payload !== null &&
    typeof payload === "object" &&
    Object.keys(payload as Record<string, unknown>).length === 0;

  return (
    <div className="payload-card">
      <div className="payload-card-header">
        <span className="status-meta">{title}</span>
      </div>
      {payload == null || isEmptyObject ? (
        <p className="empty-state compact">{emptyCopy}</p>
      ) : (
        <pre>{formatJsonPayload(payload)}</pre>
      )}
    </div>
  );
}

function summarizeEventTypes(events: RunDetail["events"]) {
  return events.reduce<Record<string, number>>((summary, event) => {
    summary[event.event_type] = (summary[event.event_type] ?? 0) + 1;
    return summary;
  }, {});
}

function countErroredNodes(run: RunDetail) {
  return run.node_runs.filter(
    (nodeRun) => nodeRun.status === "failed" || Boolean(nodeRun.error_message)
  ).length;
}
