import { NextRequest } from "next/server";

import { proxyConsoleApiRequest } from "@/app/api/_shared/console-api-proxy";

type ProviderConfigRouteContext = {
  params: Promise<{ providerConfigId: string }>;
};

export async function PUT(request: NextRequest, context: ProviderConfigRouteContext) {
  const { providerConfigId } = await context.params;
  return proxyConsoleApiRequest(request, {
    backendPath: `/api/workspace/model-providers/${encodeURIComponent(providerConfigId)}`,
    method: "PUT",
    includeJsonContentType: true,
    body: (await request.text()) || "{}"
  });
}

export async function DELETE(request: NextRequest, context: ProviderConfigRouteContext) {
  const { providerConfigId } = await context.params;
  return proxyConsoleApiRequest(request, {
    backendPath: `/api/workspace/model-providers/${encodeURIComponent(providerConfigId)}`,
    method: "DELETE"
  });
}
