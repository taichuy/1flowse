import { NextRequest } from "next/server";

import { proxyConsoleApiRequest } from "@/app/api/_shared/console-api-proxy";

export function GET(request: NextRequest) {
  return proxyConsoleApiRequest(request, {
    backendPath: `/api/workflows${request.nextUrl.search}`,
    cache: "no-store"
  });
}

export async function POST(request: NextRequest) {
  return proxyConsoleApiRequest(request, {
    backendPath: "/api/workflows",
    method: "POST",
    includeJsonContentType: true,
    body: (await request.text()) || "{}"
  });
}
