import Link from "next/link";
import { redirect } from "next/navigation";

import { WorkspaceLoginForm } from "@/components/workspace-login-form";
import { getServerAuthSession } from "@/lib/server-workspace-access";

export default async function LoginPage() {
  const session = await getServerAuthSession();
  if (session) {
    redirect("/workspace");
  }

  return (
    <main className="login-shell login-shell-dify">
      <section className="login-stage login-stage-dify login-stage-workspace">
        <header className="login-stage-header">
          <Link className="login-brand" href="/">
            <span className="workspace-brand-mark">7</span>
            <span>Flows</span>
          </Link>
          <div className="login-stage-header-actions">
            <span className="login-stage-chip">Local-first</span>
            <span className="login-stage-chip subtle">xyflow orchestration</span>
          </div>
        </header>

        <div className="login-stage-body login-stage-body-compact login-stage-body-dify">
          <div className="login-stage-copy login-stage-copy-compact">
            <p className="workspace-eyebrow">Workspace access</p>
            <h1>登录后直接进入 7Flows Workspace</h1>
            <p className="workspace-muted workspace-copy-wide">
              借鉴 Dify 的 workspace 登录心智，把登录、成员权限和应用工作台压成一条连续入口；真正的编排、运行诊断与发布治理仍然回到 7Flows 自己的 xyflow 主链。
            </p>
            <div className="login-stage-inline-points" aria-label="Workspace 登录能力">
              <span className="login-stage-inline-point">默认管理员已落库</span>
              <span className="login-stage-inline-point">管理员可继续新增成员</span>
              <span className="login-stage-inline-point">新建应用直达 xyflow Studio</span>
            </div>
          </div>

          <section className="login-card login-card-dify">
            <div className="login-copy">
              <p className="workspace-eyebrow">Workspace sign in</p>
              <h2>登录 7Flows Workspace</h2>
              <p className="workspace-muted">
                使用管理员或成员账号登录；管理员可继续新增成员、配置角色并新建应用。
              </p>
            </div>
            <WorkspaceLoginForm />
          </section>
        </div>
      </section>
    </main>
  );
}
