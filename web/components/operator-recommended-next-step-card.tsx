import React from "react";
import Link from "next/link";

import {
  buildOperatorFollowUpSurfaceCopy,
  type OperatorFollowUpSurfaceCopy,
  type OperatorRecommendedNextStep
} from "@/lib/operator-follow-up-presenters";

type OperatorRecommendedNextStepCardProps = {
  recommendedNextStep?: OperatorRecommendedNextStep | null;
  surfaceCopy?: OperatorFollowUpSurfaceCopy;
  hidePrimaryResourceSummary?: boolean;
};

export function OperatorRecommendedNextStepCard({
  recommendedNextStep,
  surfaceCopy = buildOperatorFollowUpSurfaceCopy(),
  hidePrimaryResourceSummary = false
}: OperatorRecommendedNextStepCardProps) {
  if (!recommendedNextStep) {
    return null;
  }

  return (
    <div className="entry-card compact-card">
      <div className="payload-card-header">
        <span className="status-meta">{surfaceCopy.recommendedNextStepTitle}</span>
        <span className="event-chip">{recommendedNextStep.label}</span>
        {recommendedNextStep.href && recommendedNextStep.href_label ? (
          <Link className="event-chip inbox-filter-link" href={recommendedNextStep.href}>
            {recommendedNextStep.href_label}
          </Link>
        ) : null}
      </div>
      <p className="section-copy entry-copy">{recommendedNextStep.detail}</p>
      {!hidePrimaryResourceSummary && recommendedNextStep.primaryResourceSummary ? (
        <p className="binding-meta">
          {`Primary governed resource: ${recommendedNextStep.primaryResourceSummary}.`}
        </p>
      ) : null}
    </div>
  );
}
