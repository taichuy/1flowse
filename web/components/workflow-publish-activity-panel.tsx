import { WorkflowPublishActivityFilterForm } from "@/components/workflow-publish-activity-panel-filter-form";
import {
  buildActiveFilterChips,
  buildRunStatusOptions,
  type WorkflowPublishActivityPanelProps
} from "@/components/workflow-publish-activity-panel-helpers";
import {
  WorkflowPublishActivityDetails,
  WorkflowPublishActivityInsights
} from "@/components/workflow-publish-activity-panel-sections";

export function WorkflowPublishActivityPanel({
  workflowId,
  binding,
  apiKeys,
  invocationAudit,
  rateLimitWindowAudit,
  activeInvocationFilter
}: WorkflowPublishActivityPanelProps) {
  const activeFilterChips = buildActiveFilterChips(activeInvocationFilter, apiKeys);
  const runStatusOptions = buildRunStatusOptions(invocationAudit?.facets.run_status_counts);

  return (
    <div className="entry-card compact-card">
      <p className="entry-card-title">Invocation governance</p>
      <p className="section-copy entry-copy">
        这里消费独立的 published invocation audit，用于回答“谁在调、有没有被限流、最近失败因为什么”。
      </p>

      <WorkflowPublishActivityFilterForm
        workflowId={workflowId}
        bindingId={binding.id}
        apiKeys={apiKeys}
        activeInvocationFilter={activeInvocationFilter}
        runStatusOptions={runStatusOptions}
      />

      {activeFilterChips.length ? (
        <div className="trace-active-filter-row">
          {activeFilterChips.map((chip) => (
            <span className="event-chip" key={chip}>
              {chip}
            </span>
          ))}
        </div>
      ) : null}

      <WorkflowPublishActivityInsights
        binding={binding}
        invocationAudit={invocationAudit}
        rateLimitWindowAudit={rateLimitWindowAudit}
        activeTimeWindow={activeInvocationFilter?.timeWindow ?? null}
      />

      <WorkflowPublishActivityDetails invocationAudit={invocationAudit} />
    </div>
  );
}
