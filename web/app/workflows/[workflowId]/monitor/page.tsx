import {
  generateWorkflowStudioMetadata,
  renderWorkflowStudioPage,
  type WorkflowStudioPageProps
} from "../workflow-studio-page";

export async function generateMetadata(props: WorkflowStudioPageProps) {
  return generateWorkflowStudioMetadata(props);
}

export default async function WorkflowMonitorPage(props: WorkflowStudioPageProps) {
  return renderWorkflowStudioPage({ ...props, surface: "monitor" });
}
