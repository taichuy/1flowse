import type { NotificationChannelCapabilityItem } from "@/lib/get-sensitive-access";
import {
  CHANNEL_CONFIG_STATUS_LABELS,
  CHANNEL_TARGET_KIND_LABELS,
  formatChannelTimestamp
} from "@/components/sensitive-access-inbox-page-shared";

type SensitiveAccessChannelHealthPanelProps = {
  channels: NotificationChannelCapabilityItem[];
};

export function SensitiveAccessChannelHealthPanel({
  channels
}: SensitiveAccessChannelHealthPanelProps) {
  return (
    <article className="diagnostic-panel panel-span">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Channels</p>
          <h2>通知渠道健康与 target 规则</h2>
        </div>
        <p className="section-copy">
          用统一的 channel capability + dispatch diagnostics 事实说明哪些渠道当前可投递、哪些 target
          形式被支持、最近是否持续失败，避免 worker 侧才暴露“其实配不通”的问题。
        </p>
      </div>

      <div className="activity-list">
        {channels.map((channel) => (
          <article className="activity-row" key={channel.channel}>
            <div className="activity-header">
              <div>
                <h3>{channel.channel}</h3>
                <p>{channel.summary}</p>
              </div>
              <div className="tool-badge-row">
                <span className={`health-pill ${channel.health_status}`}>
                  {channel.health_status === "ready" ? "ready" : "degraded"}
                </span>
                <span className="event-chip">{channel.delivery_mode}</span>
              </div>
            </div>
            <div className="tool-badge-row">
              <span className="event-chip">
                target {CHANNEL_TARGET_KIND_LABELS[channel.target_kind]}
              </span>
              <span className="event-chip">
                {channel.configured ? "configured" : "not configured"}
              </span>
              <span className="event-chip">pending {channel.dispatch_summary.pending_count}</span>
              <span className="event-chip">
                delivered {channel.dispatch_summary.delivered_count}
              </span>
              <span className="event-chip">failed {channel.dispatch_summary.failed_count}</span>
            </div>
            <p className="binding-meta">{channel.health_reason}</p>
            <p className="binding-meta">{channel.target_hint}</p>
            <p className="section-copy entry-copy">示例：{channel.target_example}</p>

            <div className="tool-badge-row">
              <span className="event-chip">
                latest dispatch {formatChannelTimestamp(channel.dispatch_summary.latest_dispatch_at)}
              </span>
              <span className="event-chip">
                latest delivered {formatChannelTimestamp(channel.dispatch_summary.latest_delivered_at)}
              </span>
              <span className="event-chip">
                latest failure {formatChannelTimestamp(channel.dispatch_summary.latest_failure_at)}
              </span>
            </div>

            <div className="activity-list">
              {channel.config_facts.map((fact) => (
                <article className="entry-card compact-card" key={`${channel.channel}-${fact.key}`}>
                  <div className="activity-header">
                    <div>
                      <p className="entry-card-title">{fact.label}</p>
                      <p className="section-copy entry-copy">{fact.value}</p>
                    </div>
                    <span className={`health-pill ${fact.status === "missing" ? "failed" : "ready"}`}>
                      {CHANNEL_CONFIG_STATUS_LABELS[fact.status]}
                    </span>
                  </div>
                </article>
              ))}
            </div>

            {channel.dispatch_summary.latest_failure_error ? (
              <div className="entry-card compact-card">
                <p className="entry-card-title">Latest failure</p>
                <p className="section-copy entry-copy">
                  {channel.dispatch_summary.latest_failure_target
                    ? `target ${channel.dispatch_summary.latest_failure_target} · `
                    : ""}
                  {channel.dispatch_summary.latest_failure_error}
                </p>
              </div>
            ) : null}
          </article>
        ))}
      </div>
    </article>
  );
}
