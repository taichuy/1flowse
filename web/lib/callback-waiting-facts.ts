type CallbackWaitingExplanationLike = {
  primary_signal?: string | null;
  follow_up?: string | null;
};

type ExecutionNodeCallbackWaitingSummaryFacts = {
  callback_waiting_explanation?: CallbackWaitingExplanationLike | null;
  callback_waiting_lifecycle?: object | null;
  waiting_reason?: string | null;
  scheduled_resume_delay_seconds?: number | null;
  scheduled_resume_source?: string | null;
  scheduled_waiting_status?: string | null;
  scheduled_resume_scheduled_at?: string | null;
  scheduled_resume_due_at?: string | null;
  scheduled_resume_requeued_at?: string | null;
  scheduled_resume_requeue_source?: string | null;
};

export type CallbackWaitingSummaryFacts = {
  callbackWaitingExplanation?: CallbackWaitingExplanationLike | null;
  callbackWaitingLifecycle?: object | null;
  waitingReason?: string | null;
  scheduledResumeDelaySeconds?: number | null;
  scheduledResumeSource?: string | null;
  scheduledWaitingStatus?: string | null;
  scheduledResumeScheduledAt?: string | null;
  scheduledResumeDueAt?: string | null;
  scheduledResumeRequeuedAt?: string | null;
  scheduledResumeRequeueSource?: string | null;
};

function hasTrimmedText(value?: string | null) {
  return typeof value === "string" && value.trim().length > 0;
}

export function hasCallbackWaitingSummaryFacts(
  input?: CallbackWaitingSummaryFacts | null
) {
  if (!input) {
    return false;
  }

  return Boolean(
    hasTrimmedText(input.callbackWaitingExplanation?.primary_signal) ||
      hasTrimmedText(input.callbackWaitingExplanation?.follow_up) ||
      input.callbackWaitingLifecycle ||
      hasTrimmedText(input.waitingReason) ||
      (typeof input.scheduledResumeDelaySeconds === "number" &&
        Number.isFinite(input.scheduledResumeDelaySeconds)) ||
      hasTrimmedText(input.scheduledResumeSource) ||
      hasTrimmedText(input.scheduledWaitingStatus) ||
      hasTrimmedText(input.scheduledResumeScheduledAt) ||
      hasTrimmedText(input.scheduledResumeDueAt) ||
      hasTrimmedText(input.scheduledResumeRequeuedAt) ||
      hasTrimmedText(input.scheduledResumeRequeueSource)
  );
}

export function hasExecutionNodeCallbackWaitingSummaryFacts(
  input?: ExecutionNodeCallbackWaitingSummaryFacts | null
) {
  if (!input) {
    return false;
  }

  return hasCallbackWaitingSummaryFacts({
    callbackWaitingExplanation: input.callback_waiting_explanation,
    callbackWaitingLifecycle: input.callback_waiting_lifecycle,
    waitingReason: input.waiting_reason,
    scheduledResumeDelaySeconds: input.scheduled_resume_delay_seconds,
    scheduledResumeSource: input.scheduled_resume_source,
    scheduledWaitingStatus: input.scheduled_waiting_status,
    scheduledResumeScheduledAt: input.scheduled_resume_scheduled_at,
    scheduledResumeDueAt: input.scheduled_resume_due_at,
    scheduledResumeRequeuedAt: input.scheduled_resume_requeued_at,
    scheduledResumeRequeueSource: input.scheduled_resume_requeue_source
  });
}
