"use client";

import { useCallback, useState, type Dispatch, type SetStateAction } from "react";

import {
  isRecord,
  type WorkflowEditorMessageTone
} from "./shared";

type UseWorkflowEditorWorkflowStateOptions = {
  initialDefinition: Record<string, unknown>;
  setMessage: Dispatch<SetStateAction<string | null>>;
  setMessageTone: Dispatch<SetStateAction<WorkflowEditorMessageTone>>;
};

export function useWorkflowEditorWorkflowState({
  initialDefinition,
  setMessage,
  setMessageTone
}: UseWorkflowEditorWorkflowStateOptions) {
  const [workflowVariables, setWorkflowVariables] = useState(() =>
    normalizeWorkflowVariables(initialDefinition.variables)
  );
  const [workflowPublish, setWorkflowPublish] = useState(() =>
    normalizeWorkflowPublishDraft(initialDefinition.publish)
  );

  const resetWorkflowState = useCallback((definition: Record<string, unknown>) => {
    setWorkflowVariables(normalizeWorkflowVariables(definition.variables));
    setWorkflowPublish(normalizeWorkflowPublishDraft(definition.publish));
  }, []);

  const updateWorkflowPublish = useCallback((
    nextPublish: Array<Record<string, unknown>>,
    options?: { successMessage?: string }
  ) => {
    setWorkflowPublish(normalizeWorkflowPublishDraft(nextPublish));
    applyWorkflowStateMessage(setMessage, setMessageTone, options);
  }, [setMessage, setMessageTone]);

  const updateWorkflowVariables = useCallback((
    nextVariables: Array<Record<string, unknown>>,
    options?: { successMessage?: string }
  ) => {
    setWorkflowVariables(normalizeWorkflowVariables(nextVariables));
    applyWorkflowStateMessage(setMessage, setMessageTone, options);
  }, [setMessage, setMessageTone]);

  return {
    workflowVariables,
    workflowPublish,
    resetWorkflowState,
    updateWorkflowVariables,
    updateWorkflowPublish
  };
}

function applyWorkflowStateMessage(
  setMessage: Dispatch<SetStateAction<string | null>>,
  setMessageTone: Dispatch<SetStateAction<WorkflowEditorMessageTone>>,
  options?: { successMessage?: string }
) {
  if (options?.successMessage) {
    setMessage(options.successMessage);
    setMessageTone("success");
    return;
  }

  setMessage(null);
  setMessageTone("idle");
}

function normalizeWorkflowVariables(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is Record<string, unknown> => isRecord(item)).map((item) => ({
        ...item
      }))
    : [];
}

function normalizeWorkflowPublishDraft(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is Record<string, unknown> => isRecord(item)).map((item) => ({
        ...item
      }))
    : [];
}
