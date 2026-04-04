"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import {
  LEGACY_WORKSPACE_TEAM_SETTINGS_HREF,
  WORKSPACE_TEAM_SETTINGS_HREF
} from "@/lib/workspace-console";

export function WorkspaceLoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loginName, setLoginName] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [messageTone, setMessageTone] = useState<"idle" | "error">("idle");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const nextHref = useMemo(() => {
    const candidate = searchParams?.get("next") ?? "/workspace";
    return candidate.startsWith("/") ? candidate : "/workspace";
  }, [searchParams]);
  const nextLabel = useMemo(() => getLoginNextLabel(nextHref), [nextHref]);
  const queryErrorMessage = useMemo(
    () => getWorkspaceLoginErrorMessage(searchParams?.get("error") ?? null),
    [searchParams]
  );
  const resolvedMessage = message ?? queryErrorMessage;
  const resolvedMessageTone = message ? messageTone : queryErrorMessage ? "error" : "idle";

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    setMessage("正在验证 ZITADEL 账号...");
    setMessageTone("idle");

    try {
      const response = await fetch("/api/auth/zitadel/login", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          login_name: loginName,
          password
        })
      });
      const body = (await response.json().catch(() => null)) as { detail?: string } | null;

      if (!response.ok) {
        setMessage(body?.detail ?? "登录失败。");
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
    <div className="login-form" data-component="workspace-login-zitadel-password-form">
      <form className="login-form" onSubmit={handleSubmit}>
        <div className="login-form-field">
          <label htmlFor="workspace-login-name">账号</label>
          <input
            id="workspace-login-name"
            autoComplete="username"
            className="workspace-input"
            name="login_name"
            onChange={(event) => setLoginName(event.target.value)}
            required
            value={loginName}
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
            required
            type="password"
            value={password}
          />
        </div>
        <button className="workspace-primary-button" disabled={isSubmitting} type="submit">
          {isSubmitting ? "登录中..." : `进入${nextLabel}`}
        </button>
      </form>
      <p className="login-helper-copy">登录成功后将直接回到{nextLabel}。</p>
      {resolvedMessage ? (
        <p className={`workspace-inline-message ${resolvedMessageTone === "error" ? "error" : "idle"}`}>
          {resolvedMessage}
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
      return "上一轮 ZITADEL 登录未完成，请重新输入账号密码。";
    default:
      return null;
  }
}
