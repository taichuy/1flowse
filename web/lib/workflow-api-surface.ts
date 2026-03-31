import { getApiBaseUrl } from "@/lib/api-base-url";
import type { WorkflowPublishedEndpointItem } from "@/lib/get-workflow-publish";
import { buildWorkflowPublishBindingCardSurface } from "@/lib/workflow-publish-binding-presenters";

const ANTHROPIC_VERSION = "2023-06-01";

export type WorkflowApiBindingDoc = {
  bindingId: string;
  title: string;
  endpointSummary: string;
  protocolChips: string[];
  protocolLabel: string;
  authModeLabel: string;
  authDescription: string;
  baseUrl: string;
  requestUrl: string;
  requestPath: string;
  requestBody: string;
  requestHeaders: string[];
  snippet: string;
};

type WorkflowApiRequestSurface = {
  protocolLabel: string;
  authDescription: string;
  baseUrl: string;
  requestUrl: string;
  requestPath: string;
  requestHeaders: string[];
  requestBody: Record<string, unknown>;
};

function resolvePublishedBindingTimestamp(binding: WorkflowPublishedEndpointItem) {
  const timestamp = Date.parse(binding.published_at ?? binding.updated_at ?? binding.created_at);
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function buildCurlSnippet(requestSurface: WorkflowApiRequestSurface) {
  const lines = [`curl -X POST \"${requestSurface.requestUrl}\"`];

  for (const header of requestSurface.requestHeaders) {
    lines.push(`  -H \"${header}\"`);
  }

  lines.push('  -H "Content-Type: application/json"');
  lines.push(`  -d '${JSON.stringify(requestSurface.requestBody, null, 2)}'`);

  return lines.join(" \\\n");
}

function buildOpenAiRequestSurface(
  binding: WorkflowPublishedEndpointItem
): WorkflowApiRequestSurface {
  const baseUrl = `${getApiBaseUrl()}/v1`;
  const requestUrl = `${baseUrl}/chat/completions`;
  const requestHeaders =
    binding.auth_mode === "api_key"
      ? ["Authorization: Bearer <published-api-key>"]
      : [];

  return {
    protocolLabel: "OpenAI Chat Completions",
    authDescription:
      binding.auth_mode === "api_key"
        ? "当前 binding 需要 published API key；外部 client 建议使用 Authorization: Bearer。"
        : "当前 binding 使用 internal auth，只适合工作区内部调用或受控代理转发。若要开放给外部 client，请先切到 auth_mode=api_key 并重新发布。",
    baseUrl,
    requestUrl,
    requestPath: "/chat/completions",
    requestHeaders,
    requestBody: {
      model: binding.endpoint_alias,
      messages: [{ role: "user", content: "Hello from 7Flows" }]
    }
  };
}

function buildAnthropicRequestSurface(
  binding: WorkflowPublishedEndpointItem
): WorkflowApiRequestSurface {
  const baseUrl = `${getApiBaseUrl()}/v1`;
  const requestUrl = `${baseUrl}/messages`;
  const requestHeaders = [
    ...(binding.auth_mode === "api_key" ? ["x-api-key: <published-api-key>"] : []),
    `anthropic-version: ${ANTHROPIC_VERSION}`
  ];

  return {
    protocolLabel: "Anthropic Messages",
    authDescription:
      binding.auth_mode === "api_key"
        ? "当前 binding 需要 published API key，并保留 anthropic-version header。"
        : "当前 binding 使用 internal auth；外部第三方无法直接拿这个 surface 对接，建议先切到 auth_mode=api_key 后重新发布。",
    baseUrl,
    requestUrl,
    requestPath: "/messages",
    requestHeaders,
    requestBody: {
      model: binding.endpoint_alias,
      max_tokens: 256,
      messages: [{ role: "user", content: "Hello from 7Flows" }]
    }
  };
}

function buildNativeRequestSurface(
  binding: WorkflowPublishedEndpointItem
): WorkflowApiRequestSurface {
  const baseUrl = getApiBaseUrl();
  const requestPath = `/v1/published-aliases/${encodeURIComponent(binding.endpoint_alias)}/run`;
  const requestUrl = `${baseUrl}${requestPath}`;
  const requestHeaders =
    binding.auth_mode === "api_key" ? ["x-api-key: <published-api-key>"] : [];

  return {
    protocolLabel: "7Flows native published run",
    authDescription:
      binding.auth_mode === "api_key"
        ? "当前 binding 需要 published API key；优先使用 x-api-key，对接方也可以通过受控代理改写为 Authorization header。"
        : "当前 binding 使用 internal auth；此处只展示真实 contract，不表示外部系统已可直接调用。",
    baseUrl,
    requestUrl,
    requestPath,
    requestHeaders,
    requestBody: {
      input: {
        message: "Hello from 7Flows"
      }
    }
  };
}

function buildWorkflowApiRequestSurface(binding: WorkflowPublishedEndpointItem) {
  switch (binding.protocol) {
    case "openai":
      return buildOpenAiRequestSurface(binding);
    case "anthropic":
      return buildAnthropicRequestSurface(binding);
    default:
      return buildNativeRequestSurface(binding);
  }
}

export function selectPublishedWorkflowBindings(bindings: WorkflowPublishedEndpointItem[]) {
  return [...bindings]
    .filter((binding) => binding.lifecycle_status === "published")
    .sort(
      (left, right) => resolvePublishedBindingTimestamp(right) - resolvePublishedBindingTimestamp(left)
    );
}

export function buildWorkflowApiBindingDoc(
  binding: WorkflowPublishedEndpointItem
): WorkflowApiBindingDoc {
  const bindingSurface = buildWorkflowPublishBindingCardSurface(binding);
  const requestSurface = buildWorkflowApiRequestSurface(binding);

  return {
    bindingId: binding.id,
    title: binding.endpoint_name,
    endpointSummary: bindingSurface.endpointSummary,
    protocolChips: bindingSurface.protocolChips,
    protocolLabel: requestSurface.protocolLabel,
    authModeLabel: binding.auth_mode,
    authDescription: requestSurface.authDescription,
    baseUrl: requestSurface.baseUrl,
    requestUrl: requestSurface.requestUrl,
    requestPath: requestSurface.requestPath,
    requestBody: JSON.stringify(requestSurface.requestBody, null, 2),
    requestHeaders: requestSurface.requestHeaders,
    snippet: buildCurlSnippet(requestSurface)
  };
}
