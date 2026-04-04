import Link from "next/link";
import { redirect } from "next/navigation";

import { WorkspaceLoginForm } from "@/components/workspace-login-form";
import { getServerAuthSession, getServerPublicAuthOptions } from "@/lib/server-workspace-access";

export default async function LoginPage() {
  const session = await getServerAuthSession();
  if (session) {
    redirect("/workspace");
  }

  const authOptions = await getServerPublicAuthOptions();
  const loginHeadline = getLoginHeadline(authOptions.recommended_method);
  const loginSummary = getLoginSummary(authOptions.recommended_method);

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
            <p className="workspace-eyebrow">Workspace Sign In</p>
            <h1>{loginHeadline}</h1>
            <p className="workspace-muted workspace-copy-wide">{loginSummary}</p>
          </div>

          <section className="login-card login-card-dify">
            <WorkspaceLoginForm authOptions={authOptions} />
          </section>
        </div>
      </section>
    </main>
  );
}

function getLoginHeadline(recommendedMethod: string) {
  switch (recommendedMethod) {
    case "oidc_redirect":
      return "使用标准 OIDC 登录进入 7Flows Workspace";
    case "zitadel_password":
      return "使用 ZITADEL 账号密码进入 7Flows Workspace";
    default:
      return "当前环境还没有可用的 ZITADEL 登录入口";
  }
}

function getLoginSummary(recommendedMethod: string) {
  switch (recommendedMethod) {
    case "oidc_redirect":
      return "统一认证层已经具备完整 OIDC 配置，浏览器会先跳转到身份提供方，成功后再回到当前目标页面。";
    case "zitadel_password":
      return "浏览器只把账号密码提交到同源统一认证接口，由 backend 校验 ZITADEL 会话后换成现有 7Flows workspace session。";
    default:
      return "统一认证层已经接入，但当前环境既没有完整 OIDC 配置，也没有可用的 ZITADEL 账号密码登录凭据。";
  }
}
