import { NextRequest, NextResponse } from "next/server";

import { getApiBaseUrl } from "@/lib/api-base-url";
import {
  CSRF_TOKEN_COOKIE_NAME,
  CSRF_TOKEN_HEADER_NAME,
  type AuthSessionResponse
} from "@/lib/workspace-access";

import { applyAuthCookies } from "../shared";

export async function POST(request: NextRequest) {
  const csrfHeader =
    request.headers.get(CSRF_TOKEN_HEADER_NAME) ??
    request.cookies.get(CSRF_TOKEN_COOKIE_NAME)?.value ??
    "";

  const response = await fetch(`${getApiBaseUrl()}/api/auth/refresh`, {
    method: "POST",
    headers: {
      ...(request.headers.get("cookie") ? { Cookie: request.headers.get("cookie") as string } : {}),
      ...(csrfHeader ? { [CSRF_TOKEN_HEADER_NAME]: csrfHeader } : {}),
      "Content-Type": "application/json"
    },
    body: "{}"
  });

  const body = (await response.json().catch(() => null)) as
    | AuthSessionResponse
    | { detail?: string }
    | null;

  const nextResponse = NextResponse.json(body, { status: response.status });
  if (response.ok && body && "access_token" in body && typeof body.access_token === "string") {
    applyAuthCookies(nextResponse, body as AuthSessionResponse);
  }

  return nextResponse;
}
