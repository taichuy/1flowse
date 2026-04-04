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
  const loginHeadline = getLoginHeadline(authOptions.provider, authOptions.recommended_method);
  const loginSummary = getLoginSummary(authOptions.provider, authOptions.recommended_method);

  return (
    <main className="login-shell login-shell-dify">
      <section className="login-stage login-stage-dify login-stage-workspace">
        <header className="login-stage-header">
          <Link className="login-brand" href="/">
            <span className="workspace-brand-mark">7</span>
            <span>Flows</span>
          </Link>
          <div className="login-stage-header-actions">
            <span className="login-stage-chip">{getLoginProviderLabel(authOptions.provider)}</span>
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

function getLoginProviderLabel(provider: string) {
  switch (provider) {
    case "builtin":
      return "BUILTIN";
    case "zitadel":
      return "ZITADEL";
    default:
      return "AUTH";
  }
}

function getLoginHeadline(provider: string, recommendedMethod: string) {
  switch (recommendedMethod) {
    case "oidc_redirect":
      return "使用标准 OIDC 登录进入 7Flows Workspace";
    case "password":
      return provider === "builtin"
        ? "使用内置账号密码进入 7Flows Workspace"
        : "使用统一账号密码进入 7Flows Workspace";
    default:
      return "当前环境还没有可用的统一登录入口";
  }
}

function getLoginSummary(provider: string, recommendedMethod: string) {
  switch (recommendedMethod) {
    case "oidc_redirect":
      return "统一认证层已经具备完整 OIDC 配置，浏览器会先跳转到身份提供方，成功后再回到当前目标页面。";
    case "password":
      return provider === "builtin"
        ? "本地开发默认启用 7Flows 内置认证 provider，种子账号或新建 workspace 成员都通过同一条统一认证接口换发 session。"
        : "浏览器只把账号密码提交到同源统一认证接口，由 backend 校验外部身份 provider 会话后换成现有 7Flows workspace session。";
    default:
      return "统一认证层已经接入，但当前环境还没有暴露可用的认证方法。";
  }
}
