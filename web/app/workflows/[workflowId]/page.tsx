import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { WorkflowEditorWorkbench } from "@/components/workflow-editor-workbench";
import { getPluginRegistrySnapshot } from "@/lib/get-plugin-registry";
import { getWorkflowRuns } from "@/lib/get-workflow-runs";
import { getWorkflowDetail, getWorkflows } from "@/lib/get-workflows";

type WorkflowEditorPageProps = {
  params: Promise<{ workflowId: string }>;
};

export async function generateMetadata({
  params
}: WorkflowEditorPageProps): Promise<Metadata> {
  const { workflowId } = await params;

  return {
    title: `Workflow ${workflowId} | 7Flows Studio`
  };
}

export default async function WorkflowEditorPage({
  params
}: WorkflowEditorPageProps) {
  const { workflowId } = await params;
  const [workflow, workflows, pluginRegistry, recentRuns] = await Promise.all([
    getWorkflowDetail(workflowId),
    getWorkflows(),
    getPluginRegistrySnapshot(),
    getWorkflowRuns(workflowId)
  ]);

  if (!workflow) {
    notFound();
  }

  return (
    <WorkflowEditorWorkbench
      workflow={workflow}
      workflows={workflows}
      tools={pluginRegistry.tools}
      recentRuns={recentRuns}
    />
  );
}
