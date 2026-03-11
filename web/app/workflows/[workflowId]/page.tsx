import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { WorkflowEditorWorkbench } from "@/components/workflow-editor-workbench";
import { getWorkflowLibrarySnapshot } from "@/lib/get-workflow-library";
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
  const [workflow, workflows, workflowLibrary, recentRuns] = await Promise.all([
    getWorkflowDetail(workflowId),
    getWorkflows(),
    getWorkflowLibrarySnapshot(),
    getWorkflowRuns(workflowId)
  ]);

  if (!workflow) {
    notFound();
  }

  return (
    <WorkflowEditorWorkbench
      workflow={workflow}
      workflows={workflows}
      nodeCatalog={workflowLibrary.nodes}
      nodeSourceLanes={workflowLibrary.nodeSourceLanes}
      toolSourceLanes={workflowLibrary.toolSourceLanes}
      tools={workflowLibrary.tools}
      recentRuns={recentRuns}
    />
  );
}
