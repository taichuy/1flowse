import Link from "next/link";

import type { WorkflowListItem } from "@/lib/get-workflows";

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
  const missingToolCount = workflow.tool_governance?.missing_tool_ids.length ?? 0;
  const governedToolCount = workflow.tool_governance?.governed_tool_count ?? 0;
  const strongIsolationToolCount = workflow.tool_governance?.strong_isolation_tool_count ?? 0;

  return (
    <Link className={`workflow-chip ${selected ? "selected" : ""}`} href={href}>
      <strong className="workflow-chip-title">{workflow.name}</strong>
      <small>
        {workflow.version} · {workflow.status}
      </small>
      <small>
        {workflow.node_count} nodes · {governedToolCount} governed tools · {strongIsolationToolCount} strong isolation
      </small>
      {missingToolCount > 0 ? <small>{missingToolCount} missing catalog tools</small> : null}
      {strongIsolationToolCount > 0 || missingToolCount > 0 ? (
        <div className="workflow-chip-flags">
          {strongIsolationToolCount > 0 ? <span className="event-chip">strong isolation</span> : null}
          {missingToolCount > 0 ? <span className="event-chip">missing tools</span> : null}
        </div>
      ) : null}
    </Link>
  );
}
