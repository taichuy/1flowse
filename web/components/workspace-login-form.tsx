"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Alert, Button, Input, Typography, Space } from "antd";

import type { PublicAuthOptionsResponse } from "@/lib/workspace-access";
import {
  LEGACY_WORKSPACE_TEAM_SETTINGS_HREF,
  WORKSPACE_TEAM_SETTINGS_HREF
} from "@/lib/workspace-console";

const { Text, Title } = Typography;

type WorkspaceLoginMethod = "password" | "oidc_redirect" | "unavailable";

type WorkspaceLoginFormProps = {
  authOptions: PublicAuthOptionsResponse;
};

export function WorkspaceLoginForm({ authOptions }: WorkspaceLoginFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [identifier, setIdentifier] = useState("");
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
  const primaryMethod = useMemo(
    () => resolvePrimaryLoginMethod(authOptions),
    [authOptions]
  );
  const methodMetadata = useMemo(
    () => getLoginMethodMetadata(primaryMethod, authOptions.provider),
    [authOptions.provider, primaryMethod]
  );
  const oidcStartHref = useMemo(
    () => `/api/auth/oidc/start?next=${encodeURIComponent(nextHref)}`,
    [nextHref]
  );
  const capabilityMessages = useMemo(
    () => buildCapabilityMessages(authOptions, primaryMethod),
    [authOptions, primaryMethod]
  );
  const resolvedMessage = message ?? queryErrorMessage;
  const resolvedMessageTone = message ? messageTone : queryErrorMessage ? "error" : "idle";

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (primaryMethod !== "password") {
      return;
    }

    setIsSubmitting(true);
    setMessage(methodMetadata.pendingMessage);
    setMessageTone("idle");

    try {
      const response = await fetch(methodMetadata.submitPath, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          login_name: identifier,
          password
        })
      });
      const body = (await response.json().catch(() => null)) as
        | { detail?: string; message?: string; code?: string }
        | null;

      if (!response.ok) {
        setMessage(body?.detail ?? body?.message ?? "登录失败。");
        setMessageTone("error");
        return;
      }

      router.replace(nextHref);
      router.refresh();
    } catch {
      setMessage("无法连接认证服务，请确认网络连接。");
      setMessageTone("error");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div data-component={methodMetadata.componentName}>
      <Space orientation="vertical" size="large" style={{ width: "100%" }}>
        <div style={{ textAlign: "center" }}>
          <Title level={4} style={{ marginBottom: 4 }}>{methodMetadata.title}</Title>
          <Text type="secondary">{methodMetadata.description}</Text>
        </div>

        {primaryMethod === "oidc_redirect" && (
          <div style={{ textAlign: "center" }}>
            <Button type="primary" size="large" href={oidcStartHref} block>
              {`跳转到${nextLabel}登录`}
            </Button>
            <div style={{ marginTop: 12 }}>
              <Text type="secondary" style={{ fontSize: 12 }}>认证完成后将自动返回{nextLabel}。</Text>
            </div>
          </div>
        )}

        {primaryMethod === "password" && (
          <form onSubmit={handleSubmit} style={{ width: "100%" }}>
            <Space orientation="vertical" size="middle" style={{ width: "100%" }}>
              <div>
                <div style={{ marginBottom: 4 }}><Text>{methodMetadata.identifierLabel}</Text></div>
                <Input
                  id="workspace-login-identifier"
                  autoComplete="username"
                  name={methodMetadata.identifierFieldName}
                  onChange={(event) => setIdentifier(event.target.value)}
                  required
                  value={identifier}
                  size="large"
                />
              </div>
              <div>
                <div style={{ marginBottom: 4 }}><Text>密码</Text></div>
                <Input.Password
                  id="workspace-password"
                  autoComplete="current-password"
                  name="password"
                  onChange={(event) => setPassword(event.target.value)}
                  required
                  value={password}
                  size="large"
                />
              </div>
              <Button type="primary" htmlType="submit" size="large" block loading={isSubmitting}>
                {isSubmitting ? "登录中..." : `进入${nextLabel}`}
              </Button>
              {methodMetadata.helperCopy && (
                <div style={{ textAlign: "center" }}>
                  <Text type="secondary" style={{ fontSize: 12 }}>{methodMetadata.helperCopy}</Text>
                </div>
              )}
            </Space>
          </form>
        )}

        {primaryMethod === "unavailable" && (
          <Alert title="当前无可用登录方式，请检查配置。" type="error" showIcon />
        )}

        {capabilityMessages.length > 0 && (
          <Space orientation="vertical" size="small" style={{ width: "100%" }}>
            {capabilityMessages.map((msg) => (
              <Alert key={msg} title={msg} type="warning" showIcon />
            ))}
          </Space>
        )}

        {resolvedMessage && (
          <Alert
            title={resolvedMessage}
            type={resolvedMessageTone === "error" ? "error" : "info"}
            showIcon
          />
        )}
      </Space>
    </div>
  );
}

function resolvePrimaryLoginMethod(authOptions: PublicAuthOptionsResponse): WorkspaceLoginMethod {
  const preferred = authOptions.recommended_method;
  if (preferred === "oidc_redirect" && authOptions.oidc_redirect.enabled) return preferred;
  if (preferred === "password" && authOptions.password.enabled) return preferred;
  if (authOptions.oidc_redirect.enabled) return "oidc_redirect";
  if (authOptions.password.enabled) return "password";
  return "unavailable";
}

function buildCapabilityMessages(
  authOptions: PublicAuthOptionsResponse,
  primaryMethod: WorkspaceLoginMethod
) {
  const messages: string[] = [];
  if (primaryMethod === "password" && authOptions.provider === "zitadel" && authOptions.oidc_redirect.reason) {
    messages.push(`OIDC 暂不可用：${authOptions.oidc_redirect.reason}`);
  }
  if (primaryMethod === "unavailable") {
    for (const reason of [authOptions.password.reason, authOptions.oidc_redirect.reason]) {
      if (reason) messages.push(reason);
    }
  }
  return messages;
}

function getLoginMethodMetadata(method: WorkspaceLoginMethod, provider: string) {
  switch (method) {
    case "oidc_redirect":
      return {
        componentName: "workspace-login-oidc-redirect",
        title: "OIDC 登录",
        description: "使用标准 OIDC 跳转认证",
        identifierLabel: "账号",
        identifierFieldName: "login_name",
        helperCopy: "",
        pendingMessage: "正在跳转...",
        submitPath: "/api/auth/oidc/start"
      };
    case "password":
      if (provider === "builtin") {
        return {
          componentName: "workspace-login-builtin-password-form",
          title: "内置账号登录",
          description: "使用 7Flows 内置账号密码",
          identifierLabel: "邮箱",
          identifierFieldName: "login_name",
          helperCopy: "",
          pendingMessage: "登录中...",
          submitPath: "/api/auth/password/login"
        };
      }
      return {
        componentName: "workspace-login-password-form",
        title: "ZITADEL 登录",
        description: "使用 ZITADEL 账号密码",
        identifierLabel: "账号",
        identifierFieldName: "login_name",
        helperCopy: "",
        pendingMessage: "登录中...",
        submitPath: "/api/auth/password/login"
      };
    default:
      return {
        componentName: "workspace-login-unavailable",
        title: "无法登录",
        description: "未发现有效认证配置",
        identifierLabel: "账号",
        identifierFieldName: "login_name",
        helperCopy: "",
        pendingMessage: "正在验证...",
        submitPath: ""
      };
  }
}

function getLoginNextLabel(nextHref: string) {
  if (nextHref === WORKSPACE_TEAM_SETTINGS_HREF || nextHref === LEGACY_WORKSPACE_TEAM_SETTINGS_HREF) return "成员管理";
  if (nextHref.startsWith("/workflows")) return "应用编排";
  if (nextHref.startsWith("/runs")) return "运行追踪";
  return "应用工作台";
}

function getWorkspaceLoginErrorMessage(errorCode: string | null) {
  switch ((errorCode ?? "").trim()) {
    case "oidc_callback_failed": return "OIDC 登录未完成，请重试。";
    default: return null;
  }
}
