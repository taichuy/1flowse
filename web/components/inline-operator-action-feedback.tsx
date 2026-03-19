import Link from "next/link";

import { OperatorFocusEvidenceCard } from "@/components/operator-focus-evidence-card";
import {
  buildOperatorInlineActionFeedbackModel,
  type OperatorInlineActionResultState
} from "@/lib/operator-inline-action-feedback";

type InlineOperatorActionFeedbackProps = {
  status: "idle" | "success" | "error";
  message: string;
  title: string;
  runId?: string | null;
} & OperatorInlineActionResultState;

export function InlineOperatorActionFeedback({
  status,
  message,
  title,
  runId = null,
  ...structuredResult
}: InlineOperatorActionFeedbackProps) {
  const model = buildOperatorInlineActionFeedbackModel({
    message,
    ...structuredResult
  });

  if (!message && !model.hasStructuredContent) {
    return null;
  }

  if (status !== "success" || !model.hasStructuredContent) {
    return message ? <p className={`sync-message ${status}`}>{message}</p> : null;
  }

  return (
    <div className="entry-card compact-card">
      <div className="payload-card-header">
        <span className="status-meta">{title}</span>
        {runId ? (
          <Link className="event-chip inbox-filter-link" href={`/runs/${encodeURIComponent(runId)}`}>
            open run
          </Link>
        ) : null}
      </div>
      {model.headline ? <p className="section-copy entry-copy">{model.headline}</p> : null}
      {model.outcomeFollowUp ? <p className="binding-meta">{model.outcomeFollowUp}</p> : null}
      {model.blockerDeltaSummary ? <p className="binding-meta">{model.blockerDeltaSummary}</p> : null}
      {model.runFollowUpPrimarySignal ? (
        <p className="section-copy entry-copy">{model.runFollowUpPrimarySignal}</p>
      ) : null}
      {model.runFollowUpFollowUp ? <p className="binding-meta">{model.runFollowUpFollowUp}</p> : null}
      {model.runSnapshotSummary ? <p className="binding-meta">{model.runSnapshotSummary}</p> : null}

      {model.runStatus || model.currentNodeId || model.focusNodeLabel || model.waitingReason ? (
        <dl className="compact-meta-list">
          <div>
            <dt>Run status</dt>
            <dd>{model.runStatus ?? "n/a"}</dd>
          </div>
          <div>
            <dt>Current node</dt>
            <dd>{model.currentNodeId ?? "n/a"}</dd>
          </div>
          <div>
            <dt>Focus node</dt>
            <dd>{model.focusNodeLabel ?? "n/a"}</dd>
          </div>
          <div>
            <dt>Waiting reason</dt>
            <dd>{model.waitingReason ?? "n/a"}</dd>
          </div>
        </dl>
      ) : null}

      {model.artifactCount > 0 ||
      model.artifactRefCount > 0 ||
      model.toolCallCount > 0 ||
      model.rawRefCount > 0 ? (
        <div className="tool-badge-row">
          {model.artifactCount > 0 ? (
            <span className="event-chip">artifacts {model.artifactCount}</span>
          ) : null}
          {model.artifactRefCount > 0 ? (
            <span className="event-chip">artifact refs {model.artifactRefCount}</span>
          ) : null}
          {model.toolCallCount > 0 ? (
            <span className="event-chip">tool calls {model.toolCallCount}</span>
          ) : null}
          {model.rawRefCount > 0 ? (
            <span className="event-chip">raw refs {model.rawRefCount}</span>
          ) : null}
        </div>
      ) : null}

      <OperatorFocusEvidenceCard
        artifactCount={model.artifactCount}
        artifactRefCount={model.artifactRefCount}
        artifactSummary={model.focusArtifactSummary}
        artifacts={model.focusArtifacts}
        toolCallCount={model.toolCallCount}
        toolCallSummaries={model.focusToolCallSummaries}
      />
    </div>
  );
}
