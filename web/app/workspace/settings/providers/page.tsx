import { redirect } from "next/navigation";

import { WorkspaceModelProviderSettings } from "@/components/workspace-model-provider-settings";
import { WorkspaceShell } from "@/components/workspace-shell";
import {
  WORKSPACE_MODEL_PROVIDER_SETTINGS_HREF,
  canAccessConsolePage,
  getWorkspaceConsolePageHref
} from "@/lib/workspace-console";
import {
  getServerWorkspaceContext,
  getServerWorkspaceCredentials,
  getServerWorkspaceModelProviderRegistry
} from "@/lib/server-workspace-access";

export default async function WorkspaceProviderSettingsPage() {
  const [workspaceContext, registry, credentials] = await Promise.all([
    getServerWorkspaceContext(),
    getServerWorkspaceModelProviderRegistry(),
    getServerWorkspaceCredentials()
  ]);

  if (!workspaceContext) {
    redirect(`/login?next=${encodeURIComponent(WORKSPACE_MODEL_PROVIDER_SETTINGS_HREF)}`);
  }

  if (!canAccessConsolePage("team", workspaceContext)) {
    redirect(getWorkspaceConsolePageHref("workspace"));
  }

  return (
    <WorkspaceShell
      activeNav="team"
      layout="focused"
      navigationMode="all"
      userName={workspaceContext.current_user.display_name}
      userRole={workspaceContext.current_member.role}
      workspaceName={workspaceContext.workspace.name}
    >
      <main className="workspace-main">
        <WorkspaceModelProviderSettings
          initialCatalog={registry?.catalog ?? []}
          initialCredentials={credentials}
          initialProviderConfigs={registry?.items ?? []}
          workspaceName={workspaceContext.workspace.name}
        />
      </main>
    </WorkspaceShell>
  );
}
