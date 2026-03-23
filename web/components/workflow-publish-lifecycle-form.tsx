"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import type { UpdatePublishedEndpointLifecycleState } from "@/app/actions/publish";
import type { SandboxReadinessCheck } from "@/lib/get-system-overview";
import { buildWorkflowPublishLifecycleActionSurface } from "@/lib/workflow-publish-binding-presenters";

type WorkflowPublishLifecycleFormProps = {
  workflowId: string;
  bindingId: string;
  currentStatus: "draft" | "published" | "offline";
  sandboxReadiness?: SandboxReadinessCheck | null;
  action: (
    state: UpdatePublishedEndpointLifecycleState,
    formData: FormData
  ) => Promise<UpdatePublishedEndpointLifecycleState>;
};

function PublishLifecycleSubmitButton({
  label,
  pendingLabel
}: {
  label: string;
  pendingLabel: string;
}) {
  const { pending } = useFormStatus();

  return (
    <button className="sync-button" type="submit" disabled={pending}>
      {pending ? pendingLabel : label}
    </button>
  );
}

export function WorkflowPublishLifecycleForm({
  workflowId,
  bindingId,
  currentStatus,
  sandboxReadiness,
  action
}: WorkflowPublishLifecycleFormProps) {
  const surface = buildWorkflowPublishLifecycleActionSurface({
    currentStatus,
    sandboxReadiness
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
      />
      {state.message ? (
        <p className={`sync-message ${state.status}`}>{state.message}</p>
      ) : null}
    </form>
  );
}
