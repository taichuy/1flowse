import Link from "next/link";

import type { WorkflowListItem } from "@/lib/get-workflows";
import { getWorkflowLegacyPublishAuthBacklogCount } from "@/lib/workflow-definition-governance";
import {
  buildWorkflowCatalogGapDetail,
  buildWorkflowGovernanceHandoff
} from "@/lib/workflow-governance-handoff";
import { isCurrentWorkbenchHref } from "@/lib/workbench-entry-links";

type WorkflowChipLinkProps = {
  workflow: WorkflowListItem;
  href: string;
  selected?: boolean;
  currentHref?: string | null;
};

export function WorkflowChipLink({
  workflow,
  href,
  selected = false,
  currentHref = null
}: WorkflowChipLinkProps) {
  const governedToolCount = workflow.tool_governance?.governed_tool_count ?? 0;
  const strongIsolationToolCount = workflow.tool_governance?.strong_isolation_tool_count ?? 0;
  const legacyPublishAuthBacklogCount = getWorkflowLegacyPublishAuthBacklogCount(workflow);
  const workflowGovernanceHandoff = buildWorkflowGovernanceHandoff({
    workflowId: workflow.id,
    workflowName: workflow.name,
    workflowDetailHref: href,
    toolGovernance: workflow.tool_governance ?? null,
    legacyAuthGovernance: workflow.legacy_auth_governance ?? null,
    workflowCatalogGapDetail: buildWorkflowCatalogGapDetail({
      toolGovernance: workflow.tool_governance ?? null,
      subjectLabel: "workflow",
      returnDetail:
        "打开当前 workflow 即可继续补齐 binding / LLM Agent tool policy，并沿同一份治理 handoff 收口。"
    })
  });
  const missingToolSummary = workflowGovernanceHandoff.workflowCatalogGapSummary;
  const hasMissingToolIssues = Boolean(missingToolSummary);
  const legacyAuthHandoff = workflowGovernanceHandoff.legacyAuthHandoff;
  const followUpDetails = [
    workflowGovernanceHandoff.workflowCatalogGapDetail,
    legacyAuthHandoff?.detail ?? null
  ].filter((detail): detail is string => Boolean(detail));
  const className = `workflow-chip ${selected ? "selected" : ""}`.trim();
  const isCurrentPage = isCurrentWorkbenchHref(href, currentHref);
  const content = (
    <>
      <strong className="workflow-chip-title">{workflow.name}</strong>
      <small>
        {workflow.version} · {workflow.status}
      </small>
      <small>
        {workflow.node_count} nodes · {governedToolCount} governed tools · {strongIsolationToolCount} strong isolation
      </small>
      {legacyPublishAuthBacklogCount > 0 ? (
        <small>
          {legacyPublishAuthBacklogCount} legacy auth cleanup item
          {legacyPublishAuthBacklogCount === 1 ? "" : "s"}
        </small>
      ) : null}
      {missingToolSummary ? <small>{missingToolSummary}</small> : null}
      {strongIsolationToolCount > 0 || hasMissingToolIssues || legacyPublishAuthBacklogCount > 0 ? (
        <div className="workflow-chip-flags">
          {legacyAuthHandoff?.bindingChipLabel ? (
            <span className="event-chip">{legacyAuthHandoff.bindingChipLabel}</span>
          ) : null}
          {legacyAuthHandoff?.statusChipLabel ? (
            <span className="event-chip">{legacyAuthHandoff.statusChipLabel}</span>
          ) : null}
          {strongIsolationToolCount > 0 ? <span className="event-chip">strong isolation</span> : null}
          {hasMissingToolIssues ? <span className="event-chip">catalog gap</span> : null}
        </div>
      ) : null}
      {followUpDetails.length > 0 ? (
        <div className="workflow-chip-follow-up">
          {followUpDetails.map((detail) => (
            <small key={detail}>{detail}</small>
          ))}
        </div>
      ) : null}
    </>
  );

  return isCurrentPage ? (
    <span aria-current="page" className={className}>
      {content}
    </span>
  ) : (
    <Link className={className} href={href}>
      {content}
    </Link>
  );
}
