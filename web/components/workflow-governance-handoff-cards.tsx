import React from "react";
import Link from "next/link";

import {
  buildLegacyPublishAuthGovernanceSurfaceCopy,
  type LegacyPublishAuthWorkflowHandoff
} from "@/lib/legacy-publish-auth-governance-presenters";

type WorkflowGovernanceHandoffCardsProps = {
  workflowCatalogGapSummary?: string | null;
  workflowCatalogGapDetail?: string | null;
  workflowCatalogGapHref?: string | null;
  workflowGovernanceHref?: string | null;
  legacyAuthHandoff?: LegacyPublishAuthWorkflowHandoff | null;
  cardClassName?: string;
};

export function WorkflowGovernanceHandoffCards({
  workflowCatalogGapSummary = null,
  workflowCatalogGapDetail = null,
  workflowCatalogGapHref = null,
  workflowGovernanceHref = null,
  legacyAuthHandoff = null,
  cardClassName = "entry-card compact-card"
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
          {workflowCatalogGapHref ?? workflowGovernanceHref ? (
            <Link
              className="inline-link"
              href={workflowCatalogGapHref ?? workflowGovernanceHref ?? "#"}
            >
              回到 workflow 编辑器处理 catalog gap
            </Link>
          ) : null}
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
          {workflowGovernanceHref ? (
            <Link className="inline-link" href={workflowGovernanceHref}>
              回到 workflow 编辑器处理 publish auth contract
            </Link>
          ) : null}
        </div>
      ) : null}
    </>
  );
}
