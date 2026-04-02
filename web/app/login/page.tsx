import Link from "next/link";
import { redirect } from "next/navigation";

import { WorkspaceLoginForm } from "@/components/workspace-login-form";
import { getServerAuthSession } from "@/lib/server-workspace-access";

function isEnvFlagEnabled(value: string | undefined) {
  return value?.trim().toLowerCase() === "true";
}

export default async function LoginPage() {
  const session = await getServerAuthSession();
  if (session) {
    redirect("/workspace");
  }

  const oidcEnabled = isEnvFlagEnabled(process.env.SEVENFLOWS_OIDC_ENABLED);
  const allowLocalPasswordFallback = process.env.NODE_ENV !== "production";

  return (
    <main className="login-shell login-shell-dify">
      <section className="login-stage login-stage-dify login-stage-workspace">
        <header className="login-stage-header">
          <Link className="login-brand" href="/">
            <span className="workspace-brand-mark">7</span>
            <span>Flows</span>
          </Link>
          <div className="login-stage-header-actions">
            <span className="login-stage-chip">Same-origin</span>
            <span className="login-stage-chip subtle">Workspace</span>
          </div>
        </header>

        <div className="login-stage-body login-stage-body-compact login-stage-body-dify">
          <div className="login-stage-copy login-stage-copy-compact">
            <p className="workspace-eyebrow">
              {oidcEnabled ? "Same-origin sign in" : "Workspace sign in"}
            </p>
            <h1>
              {oidcEnabled ? "通过同源 OIDC 进入 7Flows Workspace" : "进入 7Flows Workspace"}
            </h1>
            <p className="workspace-muted workspace-copy-wide">
              {oidcEnabled
                ? "浏览器统一走同源 /api/auth/*，完成 ZITADEL 登录后回到工作台；授权继续只由 backend can_access 收口。"
                : "当前环境尚未启用 ZITADEL OIDC；开发环境可显式切到本地密码辅助入口，正式环境仍应统一走同源 /api/auth/*。"}
            </p>
            <div className="login-stage-fact-list" aria-label="Workspace 登录能力">
              <article className="login-stage-fact-card">
                <strong>浏览器只打同源入口</strong>
                <p className="workspace-muted">登录开始、callback 与 session cookie 都继续落在同一条 /api/auth/* 主链上。</p>
              </article>
              <article className="login-stage-fact-card">
                <strong>登录成功直接回到目标页面</strong>
                <p className="workspace-muted">OIDC callback 完成后会继续回到 workspace、workflow 或你原本要去的受保护路由。</p>
              </article>
              <article className="login-stage-fact-card">
                <strong>{allowLocalPasswordFallback ? "开发环境可显式回退" : "授权继续由后端统一判断"}</strong>
                <p className="workspace-muted">
                  {allowLocalPasswordFallback
                    ? "本地密码只保留为开发辅助入口，不再把默认管理员密码卡常驻在主登录壳层里。"
                    : "workspace role 继续只是角色来源；真实资源动作仍统一落在 backend can_access。"}
                </p>
              </article>
            </div>
          </div>

          <section className="login-card login-card-dify">
            <div className="login-copy">
              <p className="workspace-eyebrow">Sign in</p>
              <h2>{oidcEnabled ? "继续使用 ZITADEL 登录" : "选择当前环境可用的登录入口"}</h2>
              <p className="workspace-muted">
                {oidcEnabled
                  ? "浏览器会先跳到同源 OIDC start，再由 backend callback 发放现有 auth session。"
                  : "当前页面会诚实暴露开发环境辅助入口，不再把本地默认管理员密码当作主视觉。"}
              </p>
            </div>
            <WorkspaceLoginForm
              allowLocalPasswordFallback={allowLocalPasswordFallback}
              oidcEnabled={oidcEnabled}
            />
          </section>
        </div>
      </section>
    </main>
  );
}
