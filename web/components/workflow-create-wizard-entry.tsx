"use client";

import { useEffect, useState, type ComponentType } from "react";

import { AuthoringBootstrapEntry } from "@/components/authoring-bootstrap-entry";
import { AuthoringBootstrapEntryLoadingState } from "@/components/authoring-bootstrap-entry-loading-state";
import { WorkflowCreateFirstScreenShell } from "@/components/workflow-create-wizard/first-screen-shell";
import { loadWorkflowCreateWizardBootstrap } from "@/components/workflow-create-wizard/bootstrap";
import type {
  WorkflowCreateWizardEntryProps,
  WorkflowCreateWizardProps
} from "@/components/workflow-create-wizard/types";
import { buildWorkflowCreateBootstrapLoadingSurfaceCopy } from "@/lib/workbench-entry-surfaces";

const loadWorkflowCreateWizardModule = () => import("@/components/workflow-create-wizard");

function WorkflowCreateWizardBootstrapLoadingState() {
  return (
    <AuthoringBootstrapEntryLoadingState
      surfaceCopy={buildWorkflowCreateBootstrapLoadingSurfaceCopy()}
    />
  );
}

export function WorkflowCreateWizardEntry({
  bootstrapRequest,
  initialBootstrapData = null
}: WorkflowCreateWizardEntryProps) {
  const [LoadedWorkflowCreateWizard, setLoadedWorkflowCreateWizard] = useState<ComponentType<WorkflowCreateWizardProps> | null>(null);

  useEffect(() => {
    let active = true;

    void loadWorkflowCreateWizardModule().then((module) => {
      if (!active) {
        return;
      }

      setLoadedWorkflowCreateWizard(() => module.WorkflowCreateWizard);
    });

    return () => {
      active = false;
    };
  }, []);

  const shouldRenderFirstScreenShell = Boolean(initialBootstrapData && !LoadedWorkflowCreateWizard);

  return (
    <div
      data-component="workflow-create-wizard-entry"
      data-has-initial-bootstrap={initialBootstrapData ? "true" : "false"}
      data-has-first-screen-shell={shouldRenderFirstScreenShell ? "true" : "false"}
    >
      {shouldRenderFirstScreenShell && initialBootstrapData ? (
        <WorkflowCreateFirstScreenShell {...initialBootstrapData} />
      ) : null}

      <AuthoringBootstrapEntry
        bootstrapRequest={bootstrapRequest}
        loadBootstrap={loadWorkflowCreateWizardBootstrap}
        initialBootstrapData={initialBootstrapData}
        loadingState={<WorkflowCreateWizardBootstrapLoadingState />}
      >
        {(wizardProps: WorkflowCreateWizardProps) =>
          LoadedWorkflowCreateWizard ? (
            <LoadedWorkflowCreateWizard {...wizardProps} />
          ) : initialBootstrapData ? null : (
            <WorkflowCreateWizardBootstrapLoadingState />
          )
        }
      </AuthoringBootstrapEntry>
    </div>
  );
}
