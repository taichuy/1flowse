"use client";

import dynamic from "next/dynamic";

import { AuthoringBootstrapEntry } from "@/components/authoring-bootstrap-entry";
import { AuthoringBootstrapEntryLoadingState } from "@/components/authoring-bootstrap-entry-loading-state";
import { loadWorkflowCreateWizardBootstrap } from "@/components/workflow-create-wizard/bootstrap";
import type {
  WorkflowCreateWizardEntryProps,
  WorkflowCreateWizardProps
} from "@/components/workflow-create-wizard/types";
import { buildWorkflowCreateBootstrapLoadingSurfaceCopy } from "@/lib/workbench-entry-surfaces";

const loadWorkflowCreateWizardModule = () =>
  import("@/components/workflow-create-wizard").then((module) => module.WorkflowCreateWizard);

const LazyWorkflowCreateWizard = dynamic(loadWorkflowCreateWizardModule,
  {
    ssr: false,
    loading: () => <WorkflowCreateWizardBootstrapLoadingState />
  }
);

function WorkflowCreateWizardBootstrapLoadingState() {
  return (
    <AuthoringBootstrapEntryLoadingState
      surfaceCopy={buildWorkflowCreateBootstrapLoadingSurfaceCopy()}
    />
  );
}

export function WorkflowCreateWizardEntry({
  bootstrapRequest
}: WorkflowCreateWizardEntryProps) {
  return (
    <AuthoringBootstrapEntry
      bootstrapRequest={bootstrapRequest}
      loadBootstrap={loadWorkflowCreateWizardBootstrap}
      preloadModule={loadWorkflowCreateWizardModule}
      loadingState={<WorkflowCreateWizardBootstrapLoadingState />}
    >
      {(wizardProps: WorkflowCreateWizardProps) => <LazyWorkflowCreateWizard {...wizardProps} />}
    </AuthoringBootstrapEntry>
  );
}
