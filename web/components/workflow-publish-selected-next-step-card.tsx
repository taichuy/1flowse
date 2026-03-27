import React from "react";
import Link from "next/link";

import { WorkflowGovernanceHandoffCards } from "@/components/workflow-governance-handoff-cards";
import type { PublishedInvocationSelectedNextStepSurface } from "@/lib/published-invocation-presenters";

type WorkflowPublishSelectedNextStepCardProps = {
  surface: PublishedInvocationSelectedNextStepSurface;
  showTitle?: boolean;
};

export function WorkflowPublishSelectedNextStepCard({
  surface,
  showTitle = true
}: WorkflowPublishSelectedNextStepCardProps) {
  return (
    <div className="entry-card compact-card">
      <div className="payload-card-header">
        {showTitle ? (
          <div>
            <p className="entry-card-title">{surface.title}</p>
            <p className="binding-meta">{surface.invocationId}</p>
          </div>
        ) : (
          <span className="status-meta">{surface.invocationId}</span>
        )}
        <span className="event-chip">{surface.label}</span>
      </div>
      <p className="section-copy entry-copy">{surface.detail}</p>
      {surface.primaryResourceSummary ? (
        <p className="binding-meta">
          {`Primary governed resource: ${surface.primaryResourceSummary}.`}
        </p>
      ) : null}
      {surface.workflowGovernanceHandoff ? (
        <WorkflowGovernanceHandoffCards
          workflowCatalogGapSummary={surface.workflowGovernanceHandoff.workflowCatalogGapSummary}
          workflowCatalogGapDetail={surface.workflowGovernanceHandoff.workflowCatalogGapDetail}
          workflowCatalogGapHref={surface.workflowGovernanceHandoff.workflowCatalogGapHref}
          workflowGovernanceHref={surface.workflowGovernanceHandoff.workflowGovernanceHref}
          legacyAuthHandoff={surface.workflowGovernanceHandoff.legacyAuthHandoff}
          cardClassName="payload-card compact-card"
        />
      ) : null}
      {surface.href && surface.hrefLabel ? (
        <div className="tool-badge-row">
          <Link className="event-chip inbox-filter-link" href={surface.href}>
            {surface.hrefLabel}
          </Link>
        </div>
      ) : null}
    </div>
  );
}
