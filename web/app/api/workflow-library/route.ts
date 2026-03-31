import { NextRequest } from "next/server";

import { proxyConsoleApiRequest } from "@/app/api/_shared/console-api-proxy";

export function GET(request: NextRequest) {
  return proxyConsoleApiRequest(request, {
    backendPath: `/api/workflow-library${request.nextUrl.search}`,
    cache: "no-store"
  });
}
