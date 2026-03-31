import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import {
  ACCESS_TOKEN_COOKIE_NAME,
  buildCookieHeader,
  CSRF_TOKEN_COOKIE_NAME,
  LEGACY_SESSION_COOKIE_NAME,
  REFRESH_TOKEN_COOKIE_NAME,
  type AuthSessionResponse
} from "@/lib/workspace-access";

export function getCookieNames(body: AuthSessionResponse | null) {
  return {
    access: body?.cookie_contract?.access_token_cookie_name ?? ACCESS_TOKEN_COOKIE_NAME,
    refresh: body?.cookie_contract?.refresh_token_cookie_name ?? REFRESH_TOKEN_COOKIE_NAME,
    csrf: body?.cookie_contract?.csrf_token_cookie_name ?? CSRF_TOKEN_COOKIE_NAME
  };
}

export function getCookieSecurity(body: AuthSessionResponse | null) {
  return {
    sameSite: body?.cookie_contract?.same_site ?? "lax",
    secure: body?.cookie_contract?.secure ?? process.env.NODE_ENV === "production"
  } as const;
}

export function getCookieMaxAge(expiresAt: string | null | undefined, fallbackSeconds: number) {
  if (!expiresAt) {
    return fallbackSeconds;
  }

  const expiresAtMs = Date.parse(expiresAt);
  if (Number.isNaN(expiresAtMs)) {
    return fallbackSeconds;
  }

  return Math.max(Math.floor((expiresAtMs - Date.now()) / 1000), 0);
}

export function applyAuthCookies(response: NextResponse, authBody: AuthSessionResponse) {
  const cookieNames = getCookieNames(authBody);
  const cookieSecurity = getCookieSecurity(authBody);

  if (typeof authBody.access_token === "string") {
    response.cookies.set({
      name: cookieNames.access,
      value: authBody.access_token,
      path: "/",
      httpOnly: true,
      sameSite: cookieSecurity.sameSite,
      secure: cookieSecurity.secure,
      maxAge: getCookieMaxAge(authBody.access_expires_at, 60 * 30)
    });
  }

  if (typeof authBody.refresh_token === "string") {
    response.cookies.set({
      name: cookieNames.refresh,
      value: authBody.refresh_token,
      path: "/",
      httpOnly: true,
      sameSite: cookieSecurity.sameSite,
      secure: cookieSecurity.secure,
      maxAge: getCookieMaxAge(authBody.expires_at, 60 * 60 * 24 * 7)
    });
  }

  if (typeof authBody.csrf_token === "string") {
    response.cookies.set({
      name: cookieNames.csrf,
      value: authBody.csrf_token,
      path: "/",
      httpOnly: false,
      sameSite: cookieSecurity.sameSite,
      secure: cookieSecurity.secure,
      maxAge: getCookieMaxAge(authBody.expires_at, 60 * 60 * 24 * 7)
    });
  }

  response.cookies.set({
    name: LEGACY_SESSION_COOKIE_NAME,
    value: "",
    path: "/",
    maxAge: 0,
    sameSite: cookieSecurity.sameSite,
    secure: cookieSecurity.secure
  });
}

export function clearAuthCookies(response: NextResponse, body: AuthSessionResponse | null = null) {
  const cookieNames = getCookieNames(body);
  const cookieSecurity = getCookieSecurity(body);

  for (const name of [
    cookieNames.access,
    cookieNames.refresh,
    cookieNames.csrf,
    LEGACY_SESSION_COOKIE_NAME
  ]) {
    response.cookies.set({
      name,
      value: "",
      path: "/",
      maxAge: 0,
      sameSite: cookieSecurity.sameSite,
      secure: cookieSecurity.secure
    });
  }
}

export function buildRequestCookieHeader(
  request: NextRequest,
  overrides: Record<string, string | null> = {}
) {
  const cookieEntries = new Map(request.cookies.getAll().map((item) => [item.name, item.value]));

  for (const [name, value] of Object.entries(overrides)) {
    if (!value) {
      cookieEntries.delete(name);
      continue;
    }
    cookieEntries.set(name, value);
  }

  return buildCookieHeader(
    Array.from(cookieEntries.entries()).map(([name, value]) => ({
      name,
      value
    }))
  );
}
