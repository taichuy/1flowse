"use client";

import dynamic from "next/dynamic";

import { AuthoringBootstrapEntry } from "@/components/authoring-bootstrap-entry";
import { AuthoringBootstrapEntryLoadingState } from "@/components/authoring-bootstrap-entry-loading-state";
import { loadWorkflowEditorWorkbenchBootstrap } from "@/components/workflow-editor-workbench/bootstrap";
import type {
  WorkflowEditorWorkbenchBootstrapData,
  WorkflowEditorWorkbenchEntryProps
} from "@/components/workflow-editor-workbench/types";
import { buildWorkflowEditorBootstrapLoadingSurfaceCopy } from "@/lib/workbench-entry-surfaces";

const loadWorkflowEditorWorkbenchModule = () =>
  import("@/components/workflow-editor-workbench").then(
    (module) => module.WorkflowEditorWorkbench
  );

const LazyWorkflowEditorWorkbench = dynamic(loadWorkflowEditorWorkbenchModule,
  {
    ssr: false,
    loading: () => <WorkflowEditorWorkbenchBootstrapLoadingState />
  }
);

function WorkflowEditorWorkbenchBootstrapLoadingState() {
  return (
    <AuthoringBootstrapEntryLoadingState
      surfaceCopy={buildWorkflowEditorBootstrapLoadingSurfaceCopy()}
    />
  );
}

export function WorkflowEditorWorkbenchEntry({
  bootstrapRequest,
  ...workbenchShellProps
}: WorkflowEditorWorkbenchEntryProps) {
  return (
    <AuthoringBootstrapEntry
      bootstrapRequest={bootstrapRequest}
      loadBootstrap={loadWorkflowEditorWorkbenchBootstrap}
      preloadModule={loadWorkflowEditorWorkbenchModule}
      loadingState={<WorkflowEditorWorkbenchBootstrapLoadingState />}
    >
      {(bootstrapData: WorkflowEditorWorkbenchBootstrapData) => (
        <LazyWorkflowEditorWorkbench {...workbenchShellProps} {...bootstrapData} />
      )}
    </AuthoringBootstrapEntry>
  );
}
