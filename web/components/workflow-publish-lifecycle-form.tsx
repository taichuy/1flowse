"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import type { UpdatePublishedEndpointLifecycleState } from "@/app/actions/publish";
import type { SandboxReadinessCheck } from "@/lib/get-system-overview";
import { buildWorkflowPublishLifecycleActionSurface } from "@/lib/workflow-publish-binding-presenters";
import type { WorkflowPublishedEndpointIssue } from "@/lib/get-workflow-publish";

type WorkflowPublishLifecycleFormProps = {
  workflowId: string;
  bindingId: string;
  currentStatus: "draft" | "published" | "offline";
  sandboxReadiness?: SandboxReadinessCheck | null;
  issues?: WorkflowPublishedEndpointIssue[];
  action: (
    state: UpdatePublishedEndpointLifecycleState,
    formData: FormData
  ) => Promise<UpdatePublishedEndpointLifecycleState>;
};

function PublishLifecycleSubmitButton({
  label,
  pendingLabel,
  disabled = false
}: {
  label: string;
  pendingLabel: string;
  disabled?: boolean;
}) {
  const { pending } = useFormStatus();

  return (
    <button className="sync-button" type="submit" disabled={pending || disabled}>
      {pending ? pendingLabel : label}
    </button>
  );
}

export function WorkflowPublishLifecycleForm({
  workflowId,
  bindingId,
  currentStatus,
  sandboxReadiness,
  issues,
  action
}: WorkflowPublishLifecycleFormProps) {
  const surface = buildWorkflowPublishLifecycleActionSurface({
    currentStatus,
    sandboxReadiness,
    issues
  });
  const initialState: UpdatePublishedEndpointLifecycleState = {
    status: "idle",
    message: "",
    workflowId,
    bindingId,
    nextStatus: surface.nextStatus
  };
  const [state, formAction] = useActionState(action, initialState);

  return (
    <form action={formAction} className="binding-actions publish-lifecycle-form">
      <input type="hidden" name="workflowId" value={workflowId} />
      <input type="hidden" name="bindingId" value={bindingId} />
      <input type="hidden" name="nextStatus" value={surface.nextStatus} />
      {surface.preflightDescription ? (
        <p className="section-copy entry-copy">{surface.preflightDescription}</p>
      ) : null}
      <PublishLifecycleSubmitButton
        label={surface.submitLabel}
        pendingLabel={surface.pendingLabel}
        disabled={surface.submitDisabled}
      />
      {state.message ? (
        <p className={`sync-message ${state.status}`}>{state.message}</p>
      ) : null}
    </form>
  );
}
