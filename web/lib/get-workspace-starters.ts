import { getApiBaseUrl } from "@/lib/api-base-url";
import type { WorkflowDetail } from "@/lib/get-workflows";

export type WorkspaceStarterTemplateItem = {
  id: string;
  workspace_id: string;
  name: string;
  description: string;
  business_track: "应用新建编排" | "编排节点能力" | "Dify 插件兼容" | "API 调用开放";
  default_workflow_name: string;
  workflow_focus: string;
  recommended_next_step: string;
  tags: string[];
  definition: WorkflowDetail["definition"];
  created_from_workflow_id?: string | null;
  created_from_workflow_version?: string | null;
  created_at: string;
  updated_at: string;
};

export async function getWorkspaceStarterTemplates(): Promise<
  WorkspaceStarterTemplateItem[]
> {
  try {
    const response = await fetch(`${getApiBaseUrl()}/api/workspace-starters`, {
      cache: "no-store"
    });

    if (!response.ok) {
      return [];
    }

    return (await response.json()) as WorkspaceStarterTemplateItem[];
  } catch {
    return [];
  }
}
