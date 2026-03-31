import { NextRequest } from "next/server";

import { proxyConsoleApiRequest } from "@/app/api/_shared/console-api-proxy";

type CredentialRouteContext = {
  params: Promise<{ credentialId: string }>;
};

export async function PUT(request: NextRequest, context: CredentialRouteContext) {
  const { credentialId } = await context.params;
  return proxyConsoleApiRequest(request, {
    backendPath: `/api/credentials/${encodeURIComponent(credentialId)}`,
    method: "PUT",
    includeJsonContentType: true,
    body: (await request.text()) || "{}"
  });
}

export async function DELETE(request: NextRequest, context: CredentialRouteContext) {
  const { credentialId } = await context.params;
  return proxyConsoleApiRequest(request, {
    backendPath: `/api/credentials/${encodeURIComponent(credentialId)}`,
    method: "DELETE"
  });
}
