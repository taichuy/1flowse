import Link from "next/link";
import { redirect } from "next/navigation";

import { WorkspaceMemberAdminPanel } from "@/components/workspace-member-admin-panel";
import { WorkspaceShell } from "@/components/workspace-shell";
import {
  canAccessConsolePage,
  getWorkspaceConsolePageHref
} from "@/lib/workspace-console";
import {
  getServerWorkspaceContext,
  getServerWorkspaceMembers
} from "@/lib/server-workspace-access";

export default async function WorkspaceTeamSettingsPage() {
  const [workspaceContext, members] = await Promise.all([
    getServerWorkspaceContext(),
    getServerWorkspaceMembers()
  ]);

  if (!workspaceContext) {
    redirect(`/login?next=${encodeURIComponent(getWorkspaceConsolePageHref("team"))}`);
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
        <WorkspaceMemberAdminPanel
          availableRoles={workspaceContext.available_roles}
          canManageMembers={workspaceContext.can_manage_members}
          initialMembers={members}
          workspaceName={workspaceContext.workspace.name}
        />
        <section className="workspace-panel workspace-settings-header-card" data-component="workspace-team-provider-link-card">
          <div className="workspace-settings-header-copy">
            <span className="workspace-panel-eyebrow">Next</span>
            <h2>模型供应商设置</h2>
            <p className="workspace-muted">
              团队级 OpenAI / Claude endpoint、默认模型和 credential:// 绑定已迁到独立 settings surface，供后续 LLM 节点直接引用。
            </p>
          </div>
          <div className="workspace-settings-header-actions">
            <Link className="workspace-primary-button compact" href="/workspace/settings/providers">
              打开模型供应商设置
            </Link>
          </div>
        </section>
      </main>
    </WorkspaceShell>
  );
}
