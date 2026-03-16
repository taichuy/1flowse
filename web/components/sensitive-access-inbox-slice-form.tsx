import type { SensitiveAccessInboxPageFilterState } from "@/components/sensitive-access-inbox-page-shared";

type SensitiveAccessInboxSliceFormProps = {
  filters: SensitiveAccessInboxPageFilterState;
};

function HiddenFilterFields({ filters }: SensitiveAccessInboxSliceFormProps) {
  return (
    <>
      {filters.status ? <input type="hidden" name="status" value={filters.status} /> : null}
      {filters.waitingStatus ? (
        <input type="hidden" name="waiting_status" value={filters.waitingStatus} />
      ) : null}
      {filters.requestDecision ? (
        <input type="hidden" name="decision" value={filters.requestDecision} />
      ) : null}
      {filters.requesterType ? (
        <input type="hidden" name="requester_type" value={filters.requesterType} />
      ) : null}
      {filters.notificationStatus ? (
        <input type="hidden" name="notification_status" value={filters.notificationStatus} />
      ) : null}
      {filters.notificationChannel ? (
        <input type="hidden" name="notification_channel" value={filters.notificationChannel} />
      ) : null}
    </>
  );
}

export function SensitiveAccessInboxSliceForm({ filters }: SensitiveAccessInboxSliceFormProps) {
  return (
    <article className="diagnostic-panel panel-span">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Manual slice</p>
          <h2>直接定位阻断对象</h2>
        </div>
        <p className="section-copy">
          支持直接输入 run / node run / access request / approval ticket ID，减少必须先从其他面板点进来的跳转成本。
        </p>
      </div>

      <form className="binding-form compact-stack" method="get">
        <HiddenFilterFields filters={filters} />
        <label className="binding-field">
          <span className="binding-label">Run ID</span>
          <input className="trace-text-input" defaultValue={filters.runId ?? ""} name="run_id" />
        </label>
        <label className="binding-field">
          <span className="binding-label">Node run ID</span>
          <input
            className="trace-text-input"
            defaultValue={filters.nodeRunId ?? ""}
            name="node_run_id"
          />
        </label>
        <label className="binding-field">
          <span className="binding-label">Access request ID</span>
          <input
            className="trace-text-input"
            defaultValue={filters.accessRequestId ?? ""}
            name="access_request_id"
          />
        </label>
        <label className="binding-field">
          <span className="binding-label">Approval ticket ID</span>
          <input
            className="trace-text-input"
            defaultValue={filters.approvalTicketId ?? ""}
            name="approval_ticket_id"
          />
        </label>
        <div className="binding-actions">
          <button className="sync-button" type="submit">
            应用 slice
          </button>
        </div>
      </form>
    </article>
  );
}
