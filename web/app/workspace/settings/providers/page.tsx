import { redirect } from "next/navigation";

import { WorkspaceModelProviderSettings } from "@/components/workspace-model-provider-settings";
import { WorkspaceShell } from "@/components/workspace-shell";
import {
  canAccessConsolePage,
  getWorkspaceConsolePageHref
} from "@/lib/workspace-console";
import {
  getServerWorkspaceContext,
  getServerWorkspaceModelProviderSettingsState
} from "@/lib/server-workspace-access";

export default async function WorkspaceProviderSettingsPage() {
  const workspaceContext = await getServerWorkspaceContext();

  if (!workspaceContext) {
    redirect(`/login?next=${encodeURIComponent(getWorkspaceConsolePageHref("providers"))}`);
  }

  if (!canAccessConsolePage("providers", workspaceContext)) {
    redirect(getWorkspaceConsolePageHref("workspace"));
  }

  const providerSettingsState = await getServerWorkspaceModelProviderSettingsState();

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
        {providerSettingsState.errorMessage ? (
          <section
            className="workspace-panel workspace-settings-header-card"
            data-component="workspace-model-provider-error"
          >
            <span className="workspace-panel-eyebrow">Registry Status</span>
            <h2>团队模型供应商暂不可用</h2>
            <p className="workspace-empty-notice">{providerSettingsState.errorMessage}</p>
          </section>
        ) : null}
        <WorkspaceModelProviderSettings
          initialCatalog={providerSettingsState.settings?.registry.catalog ?? []}
          initialCredentials={providerSettingsState.settings?.credentials ?? []}
          initialProviderConfigs={providerSettingsState.settings?.registry.items ?? []}
          workspaceName={workspaceContext.workspace.name}
        />
      </main>
    </WorkspaceShell>
  );
}
