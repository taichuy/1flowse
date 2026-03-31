import { NextRequest, NextResponse } from "next/server";

import { getApiBaseUrl } from "@/lib/api-base-url";
import {
  ACCESS_TOKEN_COOKIE_NAME,
  REFRESH_TOKEN_COOKIE_NAME
} from "@/lib/workspace-access";

import { clearAuthCookies } from "../shared";

export async function POST(request: NextRequest) {
  const accessToken = request.cookies.get(ACCESS_TOKEN_COOKIE_NAME)?.value ?? "";
  const refreshToken = request.cookies.get(REFRESH_TOKEN_COOKIE_NAME)?.value ?? "";

  if (accessToken || refreshToken) {
    await fetch(`${getApiBaseUrl()}/api/auth/logout`, {
      method: "POST",
      headers: {
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        ...(refreshToken ? { "X-Refresh-Token": refreshToken } : {})
      }
    }).catch(() => null);
  }

  const response = NextResponse.json({ ok: true });
  clearAuthCookies(response);
  return response;
}
