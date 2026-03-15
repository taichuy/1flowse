import type { SensitiveAccessTimelineEntry } from "@/lib/get-sensitive-access";
import { formatTimestamp } from "@/lib/runtime-presenters";

type SensitiveAccessTimelineEntryListProps = {
  entries: SensitiveAccessTimelineEntry[];
  emptyCopy: string;
};

export function SensitiveAccessTimelineEntryList({
  entries,
  emptyCopy
}: SensitiveAccessTimelineEntryListProps) {
  if (entries.length === 0) {
    return <p className="empty-state compact">{emptyCopy}</p>;
  }

  return (
    <div className="event-list">
      {entries.map((entry) => (
        <article className="event-row compact-card" key={entry.request.id}>
          <div className="event-meta">
            <span>{entry.resource.label}</span>
            <span>{entry.request.decision ?? "pending"}</span>
          </div>

          <p className="event-run">
            {entry.request.action_type} · {entry.resource.sensitivity_level} · {entry.resource.source}
          </p>

          <div className="event-type-strip">
            <span className="event-chip">requester {entry.request.requester_type}</span>
            <span className="event-chip">id {entry.request.requester_id}</span>
            {entry.request.reason_code ? (
              <span className="event-chip">reason {entry.request.reason_code}</span>
            ) : null}
            {entry.approval_ticket ? (
              <span className="event-chip">ticket {entry.approval_ticket.status}</span>
            ) : null}
            {entry.approval_ticket?.waiting_status ? (
              <span className="event-chip">waiting {entry.approval_ticket.waiting_status}</span>
            ) : null}
          </div>

          {entry.request.purpose_text ? (
            <p className="section-copy entry-copy">purpose: {entry.request.purpose_text}</p>
          ) : null}

          <dl className="compact-meta-list">
            <div>
              <dt>Requested</dt>
              <dd>{formatTimestamp(entry.request.created_at)}</dd>
            </div>
            <div>
              <dt>Decided</dt>
              <dd>{formatTimestamp(entry.request.decided_at)}</dd>
            </div>
            <div>
              <dt>Approval</dt>
              <dd>
                {entry.approval_ticket
                  ? `${entry.approval_ticket.status} · ${entry.approval_ticket.id}`
                  : "n/a"}
              </dd>
            </div>
            <div>
              <dt>Approved by</dt>
              <dd>{entry.approval_ticket?.approved_by ?? "n/a"}</dd>
            </div>
            <div>
              <dt>Approval decided</dt>
              <dd>{formatTimestamp(entry.approval_ticket?.decided_at)}</dd>
            </div>
            <div>
              <dt>Approval expires</dt>
              <dd>{formatTimestamp(entry.approval_ticket?.expires_at)}</dd>
            </div>
          </dl>

          {entry.notifications.length > 0 ? (
            <div className="event-type-strip">
              {entry.notifications.map((notification) => (
                <span className="event-chip" key={notification.id}>
                  notify {notification.channel} {notification.status}
                </span>
              ))}
            </div>
          ) : null}

          {entry.notifications.length > 0 ? (
            <dl className="compact-meta-list">
              {entry.notifications.map((notification) => (
                <div key={notification.id}>
                  <dt>{notification.channel}</dt>
                  <dd>
                    {notification.target} · {notification.status} · {formatTimestamp(notification.delivered_at ?? notification.created_at)}
                    {notification.error ? ` · ${notification.error}` : ""}
                  </dd>
                </div>
              ))}
            </dl>
          ) : null}
        </article>
      ))}
    </div>
  );
}
