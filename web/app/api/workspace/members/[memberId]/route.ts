import { NextRequest } from "next/server";

import { proxyConsoleApiRequest } from "@/app/api/_shared/console-api-proxy";

type RouteContext = {
  params: Promise<{ memberId: string }>;
};

export async function PATCH(request: NextRequest, context: RouteContext) {
  const { memberId } = await context.params;
  return proxyConsoleApiRequest(request, {
    backendPath: `/api/workspace/members/${encodeURIComponent(memberId)}`,
    method: "PATCH",
    includeJsonContentType: true,
    body: (await request.text()) || "{}"
  });
}
