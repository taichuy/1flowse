import { NextRequest, NextResponse } from "next/server";

import { getApiBaseUrl } from "@/lib/api-base-url";
import {
  ACCESS_TOKEN_COOKIE_NAME,
  buildCookieHeader,
  CSRF_TOKEN_COOKIE_NAME,
  CSRF_TOKEN_HEADER_NAME,
  REFRESH_TOKEN_COOKIE_NAME,
  type AuthSessionResponse
} from "@/lib/workspace-access";

import { applyAuthCookies } from "@/app/api/session/shared";

type ProxyConsoleApiOptions = {
  allowGuest?: boolean;
  backendPath: string;
  body?: string;
  cache?: RequestCache;
  includeJsonContentType?: boolean;
  method?: string;
};

type CookieEntry = {
  name: string;
  value: string;
};

type ConsoleRequestSession = {
  accessToken: string;
  cookieEntries: CookieEntry[];
  csrfToken: string;
  refreshToken: string;
};

function buildCookieEntries(
  entries: CookieEntry[],
  overrides: Record<string, string | null> = {}
): CookieEntry[] {
  const cookieMap = new Map(entries.map((entry) => [entry.name, entry.value]));
  for (const [name, value] of Object.entries(overrides)) {
    if (!value) {
      cookieMap.delete(name);
      continue;
    }
    cookieMap.set(name, value);
  }
  return Array.from(cookieMap.entries()).map(([name, value]) => ({ name, value }));
}

function readConsoleRequestSession(request: NextRequest): ConsoleRequestSession {
  const cookieEntries = request.cookies.getAll().map((item) => ({
    name: item.name,
    value: item.value
  }));

  return {
    accessToken: request.cookies.get(ACCESS_TOKEN_COOKIE_NAME)?.value ?? "",
    refreshToken: request.cookies.get(REFRESH_TOKEN_COOKIE_NAME)?.value ?? "",
    csrfToken: request.cookies.get(CSRF_TOKEN_COOKIE_NAME)?.value ?? "",
    cookieEntries
  };
}

function buildBackendHeaders(
  request: NextRequest,
  {
    accessToken,
    cookieEntries,
    csrfToken,
    includeJsonContentType
  }: {
    accessToken?: string;
    cookieEntries: CookieEntry[];
    csrfToken?: string;
    includeJsonContentType?: boolean;
  }
) {
  const headers = new Headers();
  const cookieHeader = buildCookieHeader(cookieEntries);
  if (cookieHeader) {
    headers.set("Cookie", cookieHeader);
  }
  if (accessToken) {
    headers.set("Authorization", `Bearer ${accessToken}`);
  }

  const effectiveCsrfToken = csrfToken ?? request.headers.get(CSRF_TOKEN_HEADER_NAME) ?? "";
  if (effectiveCsrfToken) {
    headers.set(CSRF_TOKEN_HEADER_NAME, effectiveCsrfToken);
  }

  if (includeJsonContentType) {
    headers.set("Content-Type", "application/json");
  }

  return headers;
}

async function executeBackendRequest(
  request: NextRequest,
  options: ProxyConsoleApiOptions,
  session: {
    accessToken?: string;
    cookieEntries: CookieEntry[];
    csrfToken?: string;
  }
) {
  return fetch(`${getApiBaseUrl()}${options.backendPath}`, {
    method: options.method ?? request.method,
    cache: options.cache,
    headers: buildBackendHeaders(request, {
      accessToken: session.accessToken,
      cookieEntries: session.cookieEntries,
      csrfToken: session.csrfToken,
      includeJsonContentType: options.includeJsonContentType
    }),
    body: options.body
  });
}

async function refreshConsoleSession(request: NextRequest, session: ConsoleRequestSession) {
  if (!session.refreshToken || !session.csrfToken) {
    return null;
  }

  const refreshResponse = await fetch(`${getApiBaseUrl()}/api/auth/refresh`, {
    method: "POST",
    headers: buildBackendHeaders(request, {
      cookieEntries: session.cookieEntries,
      csrfToken: session.csrfToken,
      includeJsonContentType: true
    }),
    body: "{}"
  });

  const refreshBody = (await refreshResponse.json().catch(() => null)) as
    | AuthSessionResponse
    | { detail?: string }
    | null;

  if (
    !refreshResponse.ok ||
    !refreshBody ||
    !("access_token" in refreshBody) ||
    typeof refreshBody.access_token !== "string"
  ) {
    return null;
  }

  const authBody = refreshBody as AuthSessionResponse;
  const cookieEntries = buildCookieEntries(session.cookieEntries, {
    [authBody.cookie_contract?.access_token_cookie_name ?? ACCESS_TOKEN_COOKIE_NAME]:
      authBody.access_token ?? null,
    [authBody.cookie_contract?.refresh_token_cookie_name ?? REFRESH_TOKEN_COOKIE_NAME]:
      authBody.refresh_token ?? session.refreshToken,
    [authBody.cookie_contract?.csrf_token_cookie_name ?? CSRF_TOKEN_COOKIE_NAME]:
      authBody.csrf_token ?? session.csrfToken
  });

  return {
    authBody,
    accessToken: authBody.access_token ?? "",
    csrfToken: authBody.csrf_token ?? session.csrfToken,
    cookieEntries
  };
}

export async function proxyConsoleApiRequest(request: NextRequest, options: ProxyConsoleApiOptions) {
  const session = readConsoleRequestSession(request);
  if (!options.allowGuest && !session.accessToken && !session.refreshToken) {
    return NextResponse.json({ detail: "未登录。" }, { status: 401 });
  }

  let backendResponse = await executeBackendRequest(request, options, {
    accessToken: session.accessToken,
    cookieEntries: session.cookieEntries,
    csrfToken: session.csrfToken
  });

  let refreshedAuthBody: AuthSessionResponse | null = null;
  if (backendResponse.status === 401 && session.refreshToken) {
    const refreshedSession = await refreshConsoleSession(request, session);
    if (refreshedSession) {
      refreshedAuthBody = refreshedSession.authBody;
      backendResponse = await executeBackendRequest(request, options, {
        accessToken: refreshedSession.accessToken,
        cookieEntries: refreshedSession.cookieEntries,
        csrfToken: refreshedSession.csrfToken
      });
    }
  }

  const body = await backendResponse.json().catch(() => null);
  const nextResponse = NextResponse.json(body, { status: backendResponse.status });

  if (refreshedAuthBody) {
    applyAuthCookies(nextResponse, refreshedAuthBody);
  }

  return nextResponse;
}
