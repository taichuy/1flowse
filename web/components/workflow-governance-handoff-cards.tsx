import React from "react";
import Link from "next/link";

import {
  buildLegacyPublishAuthGovernanceSurfaceCopy,
  type LegacyPublishAuthWorkflowHandoff
} from "@/lib/legacy-publish-auth-governance-presenters";
import { isCurrentWorkbenchHref } from "@/lib/workbench-entry-links";

type WorkflowGovernanceHandoffCardsProps = {
  workflowCatalogGapSummary?: string | null;
  workflowCatalogGapDetail?: string | null;
  workflowCatalogGapHref?: string | null;
  workflowGovernanceHref?: string | null;
  legacyAuthHandoff?: LegacyPublishAuthWorkflowHandoff | null;
  cardClassName?: string;
  currentHref?: string | null;
};

function renderWorkflowGovernanceLink({
  href,
  label,
  currentHref
}: {
  href?: string | null;
  label: string;
  currentHref?: string | null;
}) {
  if (!href) {
    return null;
  }

  return isCurrentWorkbenchHref(href, currentHref) ? (
    <span aria-current="page" className="inline-link">
      {label}
    </span>
  ) : (
    <Link className="inline-link" href={href}>
      {label}
    </Link>
  );
}

export function WorkflowGovernanceHandoffCards({
  workflowCatalogGapSummary = null,
  workflowCatalogGapDetail = null,
  workflowCatalogGapHref = null,
  workflowGovernanceHref = null,
  legacyAuthHandoff = null,
  cardClassName = "entry-card compact-card",
  currentHref = null
}: WorkflowGovernanceHandoffCardsProps) {
  const legacyAuthSurfaceCopy = buildLegacyPublishAuthGovernanceSurfaceCopy();

  if (!workflowCatalogGapSummary && !legacyAuthHandoff) {
    return null;
  }

  return (
    <>
      {workflowCatalogGapSummary ? (
        <div className={cardClassName}>
          <div className="payload-card-header">
            <span className="status-meta">Workflow governance</span>
            <span className="event-chip">{workflowCatalogGapSummary}</span>
          </div>
          {workflowCatalogGapDetail ? (
            <p className="section-copy entry-copy">{workflowCatalogGapDetail}</p>
          ) : null}
          {renderWorkflowGovernanceLink({
            href: workflowCatalogGapHref ?? workflowGovernanceHref,
            label: "回到 workflow 编辑器处理 catalog gap",
            currentHref
          })}
        </div>
      ) : null}

      {legacyAuthHandoff ? (
        <div className={cardClassName}>
          <div className="payload-card-header">
            <span className="status-meta">{legacyAuthSurfaceCopy.title}</span>
            <span className="event-chip">{legacyAuthHandoff.bindingChipLabel}</span>
            <span className="event-chip">{legacyAuthHandoff.statusChipLabel}</span>
          </div>
          <p className="section-copy entry-copy">{legacyAuthHandoff.detail}</p>
          {renderWorkflowGovernanceLink({
            href: workflowGovernanceHref,
            label: "回到 workflow 编辑器处理 publish auth contract",
            currentHref
          })}
        </div>
      ) : null}
    </>
  );
}
