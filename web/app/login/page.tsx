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
            <span className="login-stage-chip">ZITADEL</span>
            <span className="login-stage-chip subtle">Workspace</span>
          </div>
        </header>

        <div className="login-stage-body login-stage-body-compact login-stage-body-dify">
          <div className="login-stage-copy login-stage-copy-compact">
            <p className="workspace-eyebrow">ZITADEL Sign In</p>
            <h1>使用 ZITADEL 账号密码进入 7Flows Workspace</h1>
            <p className="workspace-muted workspace-copy-wide">
              浏览器只把账号密码提交到同源登录接口，由 backend 校验 ZITADEL 会话后换成现有
              7Flows workspace session，并在成功后直接回到你的目标页面。
            </p>
          </div>

          <section className="login-card login-card-dify">
            <div className="login-copy">
              <p className="workspace-eyebrow">Sign in</p>
              <h2>继续使用 ZITADEL 账号密码登录</h2>
              <p className="workspace-muted">
                当前页面只保留一个登录入口，不再展示本地密码辅助入口或额外跳转式 OIDC 卡片。
              </p>
            </div>
            <WorkspaceLoginForm />
          </section>
        </div>
      </section>
    </main>
  );
}
