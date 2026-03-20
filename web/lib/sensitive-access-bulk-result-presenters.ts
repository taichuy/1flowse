import type {
  SensitiveAccessBulkActionResult,
  SignalFollowUpExplanation
} from "@/lib/get-sensitive-access";
import { hasCallbackWaitingSummaryFacts } from "@/lib/callback-waiting-facts";
import {
  buildOperatorRunSampleCards,
  type OperatorRunSampleCard
} from "@/lib/operator-run-sample-cards";

export type SensitiveAccessBulkNarrativeItem = {
  label: string;
  text: string;
};

export type SensitiveAccessBulkRunSampleCard = OperatorRunSampleCard;

export function buildSensitiveAccessBulkResultNarrative(
  result: SensitiveAccessBulkActionResult
): SensitiveAccessBulkNarrativeItem[] {
  const items: SensitiveAccessBulkNarrativeItem[] = [];
  const seenTexts = new Set<string>();
  const sharedCallbackSummaryTexts = collectSharedCallbackSummaryTexts(result);
  const outcomePrimarySignal = normalizeExplanationText(result.outcomeExplanation, "primary_signal");
  const outcomeFollowUp = normalizeExplanationText(result.outcomeExplanation, "follow_up");
  const blockerDeltaSummary = result.blockerDeltaSummary?.trim() || null;
  const runFollowUpPrimarySignal = normalizeExplanationText(
    result.runFollowUpExplanation,
    "primary_signal"
  );
  const runFollowUpFollowUp = normalizeExplanationText(result.runFollowUpExplanation, "follow_up");

  pushNarrativeItem(items, seenTexts, sharedCallbackSummaryTexts, "Primary signal", outcomePrimarySignal);
  pushNarrativeItem(items, seenTexts, sharedCallbackSummaryTexts, "Follow-up", outcomeFollowUp);
  pushNarrativeItem(items, seenTexts, sharedCallbackSummaryTexts, "Blocker delta", blockerDeltaSummary);
  pushNarrativeItem(
    items,
    seenTexts,
    sharedCallbackSummaryTexts,
    "Run follow-up",
    runFollowUpPrimarySignal
  );
  pushNarrativeItem(items, seenTexts, sharedCallbackSummaryTexts, "Next step", runFollowUpFollowUp);

  return items;
}

export function buildSensitiveAccessBulkRunSampleCards(
  result: SensitiveAccessBulkActionResult
): SensitiveAccessBulkRunSampleCard[] {
  return buildOperatorRunSampleCards(result.sampledRuns ?? []);
}

function normalizeExplanationText(
  explanation: SignalFollowUpExplanation | null | undefined,
  key: keyof SignalFollowUpExplanation
) {
  const value = explanation?.[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function pushNarrativeItem(
  items: SensitiveAccessBulkNarrativeItem[],
  seenTexts: Set<string>,
  sharedCallbackSummaryTexts: Set<string>,
  label: string,
  text: string | null
) {
  if (!text) {
    return;
  }

  if (seenTexts.has(text) || sharedCallbackSummaryTexts.has(text)) {
    return;
  }

  items.push({ label, text });
  seenTexts.add(text);
}

function collectSharedCallbackSummaryTexts(result: SensitiveAccessBulkActionResult) {
  const texts = new Set<string>();

  for (const sampledRun of result.sampledRuns ?? []) {
    const snapshot = sampledRun.snapshot;
    if (!hasCallbackWaitingSummaryFacts(snapshot)) {
      continue;
    }

    const primarySignal = normalizeExplanationText(snapshot?.callbackWaitingExplanation, "primary_signal");
    const followUp = normalizeExplanationText(snapshot?.callbackWaitingExplanation, "follow_up");

    if (primarySignal) {
      texts.add(primarySignal);
    }
    if (followUp) {
      texts.add(followUp);
    }
  }

  return texts;
}
