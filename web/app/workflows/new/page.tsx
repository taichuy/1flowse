import type { Metadata } from "next";

import { WorkflowCreateWizard } from "@/components/workflow-create-wizard";
import { getWorkflowLibrarySnapshot } from "@/lib/get-workflow-library";
import { getWorkflows } from "@/lib/get-workflows";

export const metadata: Metadata = {
  title: "New Workflow | 7Flows Studio"
};

type NewWorkflowPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function NewWorkflowPage({ searchParams }: NewWorkflowPageProps) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const [workflowLibrary, workflows] = await Promise.all([
    getWorkflowLibrarySnapshot(),
    getWorkflows()
  ]);

  return (
    <WorkflowCreateWizard
      catalogToolCount={workflowLibrary.tools.length}
      starters={workflowLibrary.starters}
      starterSourceLanes={workflowLibrary.starterSourceLanes}
      nodeCatalog={workflowLibrary.nodes}
      tools={workflowLibrary.tools}
      preferredStarterId={readQueryValue(resolvedSearchParams.starter)}
      workflows={workflows}
    />
  );
}

function readQueryValue(value: string | string[] | undefined) {
  if (typeof value === "string") {
    return value;
  }
  return Array.isArray(value) ? value[0] : undefined;
}
