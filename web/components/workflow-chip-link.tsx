import Link from "next/link";

import type { WorkflowListItem } from "@/lib/get-workflows";
import {
  formatWorkflowMissingToolSummary,
  getWorkflowLegacyPublishAuthIssues,
  hasWorkflowMissingToolIssues
} from "@/lib/workflow-definition-governance";

type WorkflowChipLinkProps = {
  workflow: WorkflowListItem;
  href: string;
  selected?: boolean;
};

export function WorkflowChipLink({
  workflow,
  href,
  selected = false
}: WorkflowChipLinkProps) {
  const missingToolSummary = formatWorkflowMissingToolSummary(workflow);
  const hasMissingToolIssues = hasWorkflowMissingToolIssues(workflow);
  const governedToolCount = workflow.tool_governance?.governed_tool_count ?? 0;
  const strongIsolationToolCount = workflow.tool_governance?.strong_isolation_tool_count ?? 0;
  const legacyPublishAuthIssueCount = getWorkflowLegacyPublishAuthIssues(workflow).length;

  return (
    <Link className={`workflow-chip ${selected ? "selected" : ""}`} href={href}>
      <strong className="workflow-chip-title">{workflow.name}</strong>
      <small>
        {workflow.version} · {workflow.status}
      </small>
      <small>
        {workflow.node_count} nodes · {governedToolCount} governed tools · {strongIsolationToolCount} strong isolation
      </small>
      {legacyPublishAuthIssueCount > 0 ? (
        <small>
          {legacyPublishAuthIssueCount} publish auth blocker
          {legacyPublishAuthIssueCount === 1 ? "" : "s"}
        </small>
      ) : null}
      {missingToolSummary ? <small>{missingToolSummary}</small> : null}
      {strongIsolationToolCount > 0 || hasMissingToolIssues || legacyPublishAuthIssueCount > 0 ? (
        <div className="workflow-chip-flags">
          {legacyPublishAuthIssueCount > 0 ? (
            <span className="event-chip">publish auth blocker</span>
          ) : null}
          {strongIsolationToolCount > 0 ? <span className="event-chip">strong isolation</span> : null}
          {hasMissingToolIssues ? <span className="event-chip">catalog gap</span> : null}
        </div>
      ) : null}
    </Link>
  );
}
