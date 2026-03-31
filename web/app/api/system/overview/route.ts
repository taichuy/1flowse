import { NextRequest } from "next/server";

import { proxyConsoleApiRequest } from "@/app/api/_shared/console-api-proxy";

export function GET(request: NextRequest) {
  return proxyConsoleApiRequest(request, {
    allowGuest: true,
    backendPath: `/api/system/overview${request.nextUrl.search}`,
    cache: "no-store"
  });
}
