import { NextRequest } from "next/server";

import { proxyConsoleApiRequest } from "@/app/api/_shared/console-api-proxy";

type WorkflowRouteProps = {
  params: Promise<{
    workflowId: string;
  }>;
};

export async function PUT(request: NextRequest, { params }: WorkflowRouteProps) {
  const { workflowId } = await params;
  return proxyConsoleApiRequest(request, {
    backendPath: `/api/workflows/${encodeURIComponent(workflowId)}`,
    method: "PUT",
    includeJsonContentType: true,
    body: (await request.text()) || "{}"
  });
}
