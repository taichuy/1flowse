import { NextRequest } from "next/server";

import { proxyConsoleApiRequest } from "@/app/api/_shared/console-api-proxy";

type WorkflowValidateDefinitionRouteProps = {
  params: Promise<{
    workflowId: string;
  }>;
};

export async function POST(request: NextRequest, { params }: WorkflowValidateDefinitionRouteProps) {
  const { workflowId } = await params;
  return proxyConsoleApiRequest(request, {
    backendPath: `/api/workflows/${encodeURIComponent(workflowId)}/validate-definition`,
    method: "POST",
    includeJsonContentType: true,
    body: (await request.text()) || "{}"
  });
}
