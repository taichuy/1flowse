import type { CallbackWaitingAutomationCheck } from "@/lib/get-system-overview";

type CallbackWaitingAutomationPanelProps = {
  automation: CallbackWaitingAutomationCheck;
};

const statusLabelMap: Record<string, string> = {
  configured: "configured",
  partial: "partial",
  disabled: "disabled"
};

const statusClassMap: Record<string, string> = {
  configured: "healthy",
  partial: "degraded",
  disabled: "failed"
};

export function CallbackWaitingAutomationPanel({
  automation
}: CallbackWaitingAutomationPanelProps) {
  const enabledSteps = automation.steps.filter((step) => step.enabled);

  return (
    <article className="diagnostic-panel panel-span">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Callback waiting</p>
          <h2>Background recovery automation</h2>
        </div>
        <p className="section-copy">
          把 `WAITING_CALLBACK` 的后台补偿配置直接暴露给 operator，避免链路已经落地，
          但首页仍看不出 stale ticket cleanup 和 due resume monitor 是否真的打开。
        </p>
      </div>

      <div className="summary-strip">
        <article className="summary-card">
          <span>Automation status</span>
          <strong>{statusLabelMap[automation.status] ?? automation.status}</strong>
        </article>
        <article className="summary-card">
          <span>Enabled steps</span>
          <strong>{enabledSteps.length} / {automation.steps.length}</strong>
        </article>
        <article className="summary-card">
          <span>Scheduler required</span>
          <strong>{automation.scheduler_required ? "yes" : "no"}</strong>
        </article>
      </div>

      <div className="activity-list">
        {automation.steps.map((step) => (
          <article className="activity-row" key={step.key}>
            <div className="activity-header">
              <div>
                <h3>{step.label}</h3>
                <p>
                  {step.task} · source {step.source}
                  {typeof step.interval_seconds === "number"
                    ? ` · every ${step.interval_seconds}s`
                    : " · no active schedule"}
                </p>
              </div>
              <span
                className={`health-pill ${step.enabled ? "healthy" : "failed"}`}
              >
                {step.enabled ? "enabled" : "disabled"}
              </span>
            </div>
            <p className="activity-copy">{step.detail}</p>
          </article>
        ))}
      </div>

      <div className="event-type-strip">
        <span className={`event-chip ${statusClassMap[automation.status] ?? ""}`}>
          {statusLabelMap[automation.status] ?? automation.status}
        </span>
        {automation.scheduler_required ? (
          <span className="event-chip">needs separate scheduler</span>
        ) : null}
      </div>

      <p className="section-copy compact">{automation.detail}</p>
    </article>
  );
}
