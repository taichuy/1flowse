"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import {
  LEGACY_WORKSPACE_TEAM_SETTINGS_HREF,
  WORKSPACE_TEAM_SETTINGS_HREF
} from "@/lib/workspace-console";

const DEFAULT_ADMIN_EMAIL = "admin@taichuy.com";
const DEFAULT_ADMIN_PASSWORD = "admin123";

type WorkspaceLoginFormProps = {
  oidcEnabled?: boolean;
  allowLocalPasswordFallback?: boolean;
};

export function WorkspaceLoginForm({
  oidcEnabled = true,
  allowLocalPasswordFallback = false
}: WorkspaceLoginFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [messageTone, setMessageTone] = useState<"idle" | "error">("idle");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showLocalPasswordFallback, setShowLocalPasswordFallback] = useState(
    !oidcEnabled && allowLocalPasswordFallback
  );

  const nextHref = useMemo(() => {
    const candidate = searchParams?.get("next") ?? "/workspace";
    return candidate.startsWith("/") ? candidate : "/workspace";
  }, [searchParams]);
  const nextLabel = useMemo(() => getLoginNextLabel(nextHref), [nextHref]);
  const oidcStartHref = useMemo(
    () => `/api/auth/oidc/start?next=${encodeURIComponent(nextHref)}`,
    [nextHref]
  );
  const queryErrorMessage = useMemo(
    () => getWorkspaceLoginErrorMessage(searchParams?.get("error") ?? null),
    [searchParams]
  );
  const resolvedMessage = message ?? queryErrorMessage;
  const resolvedMessageTone = message ? messageTone : queryErrorMessage ? "error" : "idle";
  const showInlineLocalPasswordForm =
    allowLocalPasswordFallback && (showLocalPasswordFallback || !oidcEnabled);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    setMessage("正在进入工作台...");
    setMessageTone("idle");

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          email,
          password
        })
      });
      const body = (await response.json().catch(() => null)) as
        | { detail?: string }
        | { token?: string }
        | null;

      if (!response.ok) {
        setMessage(body && "detail" in body ? body.detail ?? "登录失败。" : "登录失败。");
        setMessageTone("error");
        return;
      }

      router.replace(nextHref);
      router.refresh();
    } catch {
      setMessage("无法连接认证服务，请确认 web 与 api 都已启动。");
      setMessageTone("error");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="login-form"
      data-component={oidcEnabled ? "workspace-login-oidc-shell" : "workspace-login-local-shell"}
    >
      {oidcEnabled ? (
        <section className="login-credential-card" data-component="workspace-login-oidc-primary-card">
          <div>
            <p className="login-credential-label">同源 OIDC 主入口</p>
            <p className="login-hint">
              浏览器会先跳到 ZITADEL，再由 backend callback 发放现有 auth session 并回到
              {nextLabel}。
            </p>
          </div>
          <a
            className="workspace-primary-button"
            data-component="workspace-login-oidc-cta"
            href={oidcStartHref}
          >
            使用 ZITADEL 登录
          </a>
        </section>
      ) : (
        <section className="login-credential-card" data-component="workspace-login-dev-fallback-card">
          <div>
            <p className="login-credential-label">开发环境辅助入口</p>
            <p className="login-hint">
              当前环境显式关闭了 ZITADEL OIDC 主入口；仅在 local-first 开发时使用本地密码进入
              {nextLabel}。
            </p>
          </div>
        </section>
      )}
      <p className="login-helper-copy">
        {oidcEnabled
          ? `登录完成后将回到 ${nextLabel}；浏览器与 SSR 继续共用同源 /api/auth/* 会话链。`
          : `当前环境将通过本地开发密码进入 ${nextLabel}；正式环境仍应切回同源 OIDC。`}
      </p>
      {resolvedMessage ? (
        <p className={`workspace-inline-message ${resolvedMessageTone === "error" ? "error" : "idle"}`}>
          {resolvedMessage}
        </p>
      ) : null}
      {oidcEnabled && allowLocalPasswordFallback && !showInlineLocalPasswordForm ? (
        <button
          className="workspace-ghost-button compact"
          data-component="workspace-login-local-toggle"
          onClick={() => {
            setShowLocalPasswordFallback(true);
            setMessage(null);
            setMessageTone("idle");
          }}
          type="button"
        >
          使用本地开发密码（仅辅助）
        </button>
      ) : null}
      {showInlineLocalPasswordForm ? (
        <form className="login-form" onSubmit={handleSubmit}>
          {oidcEnabled ? (
            <p className="login-helper-copy">
              已切换到开发环境辅助入口；默认管理员账号仍沿用 {DEFAULT_ADMIN_EMAIL} / {DEFAULT_ADMIN_PASSWORD}。
            </p>
          ) : null}
          <div className="login-form-field">
            <label htmlFor="workspace-email">邮箱</label>
            <input
              id="workspace-email"
              autoComplete="email"
              className="workspace-input"
              name="email"
              onChange={(event) => setEmail(event.target.value)}
              value={email}
            />
          </div>
          <div className="login-form-field">
            <label htmlFor="workspace-password">密码</label>
            <input
              id="workspace-password"
              autoComplete="current-password"
              className="workspace-input"
              name="password"
              onChange={(event) => setPassword(event.target.value)}
              type="password"
              value={password}
            />
          </div>
          <button
            className={oidcEnabled ? "workspace-ghost-button" : "workspace-primary-button"}
            disabled={isSubmitting}
            type="submit"
          >
            {isSubmitting ? "进入中..." : "使用本地密码进入"}
          </button>
        </form>
      ) : null}
      {!oidcEnabled && !allowLocalPasswordFallback ? (
        <p className="workspace-inline-message error">
          当前环境关闭了 OIDC 主入口，也没有开放本地密码辅助入口。
        </p>
      ) : null}
    </div>
  );
}

function getLoginNextLabel(nextHref: string) {
  if (
    nextHref === WORKSPACE_TEAM_SETTINGS_HREF ||
    nextHref === LEGACY_WORKSPACE_TEAM_SETTINGS_HREF
  ) {
    return "成员管理";
  }

  if (nextHref.startsWith("/workflows")) {
    return "应用编排";
  }

  if (nextHref.startsWith("/runs")) {
    return "运行追踪";
  }

  return "应用工作台";
}

function getWorkspaceLoginErrorMessage(errorCode: string | null) {
  switch ((errorCode ?? "").trim()) {
    case "oidc_callback_failed":
      return "ZITADEL 登录未完成，请重新发起同源登录；如仅在本地联调，可改用开发环境辅助入口。";
    default:
      return null;
  }
}
