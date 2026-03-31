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
  getServerWorkspaceModelProviderRegistryState
} from "@/lib/server-workspace-access";

export default async function WorkspaceProviderSettingsPage() {
  const workspaceContext = await getServerWorkspaceContext();

  if (!workspaceContext) {
    redirect(`/login?next=${encodeURIComponent(WORKSPACE_MODEL_PROVIDER_SETTINGS_HREF)}`);
  }

  if (!canAccessConsolePage("team", workspaceContext)) {
    redirect(getWorkspaceConsolePageHref("workspace"));
  }

  const [registryState, credentials] = await Promise.all([
    getServerWorkspaceModelProviderRegistryState(),
    getServerWorkspaceCredentials()
  ]);

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
        {registryState.errorMessage ? (
          <section
            className="workspace-panel workspace-settings-header-card"
            data-component="workspace-model-provider-error"
          >
            <span className="workspace-panel-eyebrow">Registry Status</span>
            <h2>团队模型供应商暂不可用</h2>
            <p className="workspace-empty-notice">{registryState.errorMessage}</p>
          </section>
        ) : null}
        <WorkspaceModelProviderSettings
          initialCatalog={registryState.registry?.catalog ?? []}
          initialCredentials={credentials}
          initialProviderConfigs={registryState.registry?.items ?? []}
          workspaceName={workspaceContext.workspace.name}
        />
      </main>
    </WorkspaceShell>
  );
}
