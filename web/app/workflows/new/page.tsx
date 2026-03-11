import type { Metadata } from "next";

import { WorkflowCreateWizard } from "@/components/workflow-create-wizard";
import { getPluginRegistrySnapshot } from "@/lib/get-plugin-registry";
import { getWorkspaceStarterTemplates } from "@/lib/get-workspace-starters";
import { getWorkflows } from "@/lib/get-workflows";

export const metadata: Metadata = {
  title: "New Workflow | 7Flows Studio"
};

export default async function NewWorkflowPage() {
  const [pluginRegistry, workflows, workspaceTemplates] = await Promise.all([
    getPluginRegistrySnapshot(),
    getWorkflows(),
    getWorkspaceStarterTemplates()
  ]);

  return (
    <WorkflowCreateWizard
      catalogToolCount={pluginRegistry.tools.length}
      workflows={workflows}
      workspaceTemplates={workspaceTemplates}
    />
  );
}
