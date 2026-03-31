import { NextRequest, NextResponse } from "next/server";

import { getApiBaseUrl } from "@/lib/api-base-url";
import { type AuthSessionResponse } from "@/lib/workspace-access";

import { applyAuthCookies } from "../shared";

export async function POST(request: NextRequest) {
  const payload = await request.json().catch(() => null);
  const response = await fetch(`${getApiBaseUrl()}/api/auth/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload ?? {})
  });
  const body = (await response.json().catch(() => null)) as
    | AuthSessionResponse
    | { detail?: string }
    | null;

  const nextResponse = NextResponse.json(body, {
    status: response.status
  });

  if (response.ok && body && "access_token" in body && typeof body.access_token === "string") {
    applyAuthCookies(nextResponse, body as AuthSessionResponse);
  }

  return nextResponse;
}
