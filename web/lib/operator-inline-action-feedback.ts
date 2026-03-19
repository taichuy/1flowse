import type { RunSnapshot } from "@/app/actions/run-snapshot";

import { formatRunSnapshotSummary } from "./operator-action-result-presenters";

export type SignalFollowUpExplanation = {
  primary_signal?: string | null;
  follow_up?: string | null;
};

export type OperatorInlineActionResultState = {
  outcomeExplanation?: SignalFollowUpExplanation | null;
  runFollowUpExplanation?: SignalFollowUpExplanation | null;
  blockerDeltaSummary?: string | null;
  runSnapshot?: RunSnapshot | null;
};

export type OperatorInlineActionFeedbackModel = {
  hasStructuredContent: boolean;
  headline: string | null;
  outcomeFollowUp: string | null;
  runFollowUpPrimarySignal: string | null;
  runFollowUpFollowUp: string | null;
  blockerDeltaSummary: string | null;
  runSnapshotSummary: string | null;
  runStatus: string | null;
  currentNodeId: string | null;
  focusNodeLabel: string | null;
  waitingReason: string | null;
  artifactCount: number;
  artifactRefCount: number;
  toolCallCount: number;
  rawRefCount: number;
};

function normalizeText(value?: string | null) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

export function hasStructuredOperatorInlineActionResult(input: OperatorInlineActionResultState) {
  return Boolean(buildOperatorInlineActionFeedbackModel(input).hasStructuredContent);
}

export function buildOperatorInlineActionFeedbackModel(
  input: OperatorInlineActionResultState & {
    message?: string | null;
  }
): OperatorInlineActionFeedbackModel {
  const outcomePrimarySignal = normalizeText(input.outcomeExplanation?.primary_signal);
  const outcomeFollowUp = normalizeText(input.outcomeExplanation?.follow_up);
  const runFollowUpPrimarySignal = normalizeText(input.runFollowUpExplanation?.primary_signal);
  const runFollowUpFollowUp = normalizeText(input.runFollowUpExplanation?.follow_up);
  const blockerDeltaSummary = normalizeText(input.blockerDeltaSummary);
  const runSnapshotSummary = normalizeText(formatRunSnapshotSummary(input.runSnapshot ?? {}));
  const runStatus = normalizeText(input.runSnapshot?.status);
  const currentNodeId = normalizeText(input.runSnapshot?.currentNodeId);
  const focusNodeLabel =
    normalizeText(input.runSnapshot?.executionFocusNodeName) ??
    normalizeText(input.runSnapshot?.executionFocusNodeId);
  const waitingReason = normalizeText(input.runSnapshot?.waitingReason);
  const artifactCount =
    input.runSnapshot?.executionFocusArtifactCount ??
    input.runSnapshot?.executionFocusArtifacts?.length ??
    0;
  const artifactRefCount = input.runSnapshot?.executionFocusArtifactRefCount ?? 0;
  const toolCallCount =
    input.runSnapshot?.executionFocusToolCallCount ??
    input.runSnapshot?.executionFocusToolCalls?.length ??
    0;
  const rawRefCount =
    input.runSnapshot?.executionFocusRawRefCount ??
    input.runSnapshot?.executionFocusToolCalls?.filter((item) => normalizeText(item?.raw_ref)).length ??
    0;
  const headline =
    outcomePrimarySignal ??
    runFollowUpPrimarySignal ??
    runSnapshotSummary ??
    normalizeText(input.message) ??
    null;

  return {
    hasStructuredContent: Boolean(
      outcomePrimarySignal ||
        outcomeFollowUp ||
        runFollowUpPrimarySignal ||
        runFollowUpFollowUp ||
        blockerDeltaSummary ||
        runSnapshotSummary ||
        runStatus ||
        currentNodeId ||
        focusNodeLabel ||
        waitingReason ||
        artifactCount > 0 ||
        artifactRefCount > 0 ||
        toolCallCount > 0 ||
        rawRefCount > 0
    ),
    headline,
    outcomeFollowUp,
    runFollowUpPrimarySignal:
      runFollowUpPrimarySignal && runFollowUpPrimarySignal !== headline
        ? runFollowUpPrimarySignal
        : null,
    runFollowUpFollowUp,
    blockerDeltaSummary,
    runSnapshotSummary:
      runSnapshotSummary &&
      runSnapshotSummary !== headline &&
      runSnapshotSummary !== runFollowUpPrimarySignal
        ? runSnapshotSummary
        : null,
    runStatus,
    currentNodeId,
    focusNodeLabel,
    waitingReason,
    artifactCount,
    artifactRefCount,
    toolCallCount,
    rawRefCount
  };
}
