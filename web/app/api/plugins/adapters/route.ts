import { NextRequest } from "next/server";

import { proxyConsoleApiRequest } from "@/app/api/_shared/console-api-proxy";

export function GET(request: NextRequest) {
  return proxyConsoleApiRequest(request, {
    allowGuest: true,
    backendPath: `/api/plugins/adapters${request.nextUrl.search}`,
    cache: "no-store"
  });
}
