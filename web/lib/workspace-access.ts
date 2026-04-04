import { formatTimestamp } from "@/lib/runtime-presenters";

const AUTH_COOKIE_PREFIX = process.env.NODE_ENV === "production" ? "__Host-" : "";

export const ACCESS_TOKEN_COOKIE_NAME = `${AUTH_COOKIE_PREFIX}sevenflows_access_token`;
export const REFRESH_TOKEN_COOKIE_NAME = `${AUTH_COOKIE_PREFIX}sevenflows_refresh_token`;
export const CSRF_TOKEN_COOKIE_NAME = `${AUTH_COOKIE_PREFIX}sevenflows_csrf_token`;
export const CSRF_TOKEN_HEADER_NAME = "X-CSRF-Token";
export const LEGACY_SESSION_COOKIE_NAME = "sevenflows_session";
export const SESSION_COOKIE_NAME = ACCESS_TOKEN_COOKIE_NAME;

export type WorkspaceMemberRole = "owner" | "admin" | "editor" | "viewer";
export type ConsoleAccessLevel = "guest" | "authenticated" | "manager";

export type WorkspaceItem = {
  id: string;
  name: string;
  slug: string;
};

export type UserAccountItem = {
  id: string;
  email: string;
  display_name: string;
  status: string;
  last_login_at?: string | null;
};

export type WorkspaceMemberItem = {
  id: string;
  role: WorkspaceMemberRole;
  user: UserAccountItem;
  invited_by_user_id?: string | null;
  created_at: string;
  updated_at: string;
};

export type ConsoleAuthCookieContract = {
  access_token_cookie_name: string;
  refresh_token_cookie_name: string;
  csrf_token_cookie_name: string;
  csrf_header_name: string;
  same_site: "lax" | "strict" | "none";
  secure: boolean;
  use_host_prefix: boolean;
  access_token_http_only: boolean;
  refresh_token_http_only: boolean;
  csrf_token_http_only: boolean;
};

export type ConsoleRoutePermissionItem = {
  route: string;
  access_level: ConsoleAccessLevel;
  methods: string[];
  csrf_protected_methods: string[];
  description: string;
};

export type AuthMethod = "zitadel_password" | "oidc_redirect" | "unavailable";

export type PublicAuthOptionItem = {
  enabled: boolean;
  reason?: string | null;
};

export type PublicAuthOptionsResponse = {
  provider: string;
  recommended_method: AuthMethod;
  zitadel_password: PublicAuthOptionItem;
  oidc_redirect: PublicAuthOptionItem;
};

export type AuthSessionResponse = {
  token_type?: "bearer";
  token?: string | null;
  access_token?: string | null;
  refresh_token?: string | null;
  csrf_token?: string | null;
  workspace: WorkspaceItem;
  current_user: UserAccountItem;
  current_member: WorkspaceMemberItem;
  available_roles: WorkspaceMemberRole[];
  expires_at: string;
  access_expires_at?: string | null;
  cookie_contract?: ConsoleAuthCookieContract;
  route_permissions?: ConsoleRoutePermissionItem[];
};

export type WorkspaceContextResponse = {
  workspace: WorkspaceItem;
  current_user: UserAccountItem;
  current_member: WorkspaceMemberItem;
  available_roles: WorkspaceMemberRole[];
  can_manage_members: boolean;
  cookie_contract?: ConsoleAuthCookieContract;
  route_permissions?: ConsoleRoutePermissionItem[];
};

export function formatWorkspaceRole(role: WorkspaceMemberRole) {
  switch (role) {
    case "owner":
      return "所有者";
    case "admin":
      return "管理员";
    case "editor":
      return "编辑者";
    case "viewer":
      return "观察者";
    default:
      return role;
  }
}

export function canManageWorkspaceMembers(role: WorkspaceMemberRole) {
  return role === "owner" || role === "admin";
}

export function describeWorkspaceMemberActivity(member: WorkspaceMemberItem) {
  if (!member.user.last_login_at) {
    return "尚未登录";
  }

  return `最近登录 ${formatTimestamp(member.user.last_login_at)}`;
}

export function readAuthCookieFromDocument(cookieName: string) {
  if (typeof document === "undefined") {
    return null;
  }

  const targetPrefix = `${cookieName}=`;
  const rawCookie = document.cookie
    .split(";")
    .map((item) => item.trim())
    .find((item) => item.startsWith(targetPrefix));

  if (!rawCookie) {
    return null;
  }

  return decodeURIComponent(rawCookie.slice(targetPrefix.length));
}

export function readSessionCookieFromDocument() {
  return null;
}

export function readCsrfCookieFromDocument() {
  return readAuthCookieFromDocument(CSRF_TOKEN_COOKIE_NAME);
}

export function buildConsoleCsrfHeaders(): Record<string, string> {
  const csrfToken = readCsrfCookieFromDocument();
  if (!csrfToken) {
    return {};
  }

  return {
    [CSRF_TOKEN_HEADER_NAME]: csrfToken
  };
}

export function buildCookieHeader(entries: Array<{ name: string; value: string }>) {
  return entries
    .filter((entry) => entry.name && entry.value)
    .map((entry) => `${entry.name}=${encodeURIComponent(entry.value)}`)
    .join("; ");
}
