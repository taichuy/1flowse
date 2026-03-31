import { getApiBaseUrl } from "@/lib/api-base-url";
import type { WorkflowPublishedEndpointItem } from "@/lib/get-workflow-publish";
import { buildWorkflowPublishBindingCardSurface } from "@/lib/workflow-publish-binding-presenters";

const ANTHROPIC_VERSION = "2023-06-01";

type WorkflowApiDocMetaRow = {
  label: string;
  value: string;
};

export type WorkflowApiDocSection = {
  id: string;
  navLabel: string;
  eyebrow: string;
  title: string;
  description: string;
  metaRows?: WorkflowApiDocMetaRow[];
  bulletItems?: string[];
  codeBlock?: string;
  codeLabel?: string;
};

export type WorkflowApiBindingDoc = {
  bindingId: string;
  anchorId: string;
  title: string;
  endpointSummary: string;
  directorySummary: string;
  protocolChips: string[];
  protocolLabel: string;
  authModeLabel: string;
  baseUrl: string;
  requestPath: string;
  sections: WorkflowApiDocSection[];
};

type WorkflowApiRequestSurface = {
  protocolLabel: string;
  authDescription: string;
  baseUrl: string;
  requestUrl: string;
  requestPath: string;
  requestHeaders: string[];
  requestBody: Record<string, unknown>;
  protocolDifferences: string[];
};

function sanitizeWorkflowApiAnchorSegment(value: string) {
  const sanitized = value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return sanitized || "binding";
}

function buildWorkflowApiAnchorId(binding: WorkflowPublishedEndpointItem) {
  return `workflow-api-${sanitizeWorkflowApiAnchorSegment(binding.id)}`;
}

function buildWorkflowApiSectionId(anchorId: string, suffix: string) {
  return `${anchorId}-${suffix}`;
}

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
    },
    protocolDifferences: [
      `当前 binding 直接走 ${requestUrl}，model 字段继续使用已发布 alias ${binding.endpoint_alias}。`,
      binding.auth_mode === "api_key"
        ? "鉴权头使用 Authorization: Bearer，并沿用 published API key。"
        : "当前处于 internal auth 模式，不额外暴露 published API key。",
      binding.streaming
        ? "当前 binding 已开启 streaming；调用方可继续按 OpenAI chat completions streaming 心智接入。"
        : "当前 binding 未开启 streaming；先完成最小请求闭环，再决定是否补 streaming client。"
    ]
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
    },
    protocolDifferences: [
      `消息入口固定走 ${requestUrl}，并保留 anthropic-version: ${ANTHROPIC_VERSION}。`,
      `model 字段继续使用已发布 alias ${binding.endpoint_alias}，不需要团队成员再回头翻 publish metadata。`,
      binding.auth_mode === "api_key"
        ? "鉴权沿用 x-api-key；如要接第三方 Claude SDK，优先保持这个 header 形状不变。"
        : "当前 binding 仍依赖 internal auth；对外开放前需要重新发布 api_key 版本。"
    ]
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
    },
    protocolDifferences: [
      `当前 native route 直接走 ${requestPath}，请求体继续包裹在 input 对象里。`,
      `published alias ${binding.endpoint_alias} 已被编码进 route，不需要再单独传 model 字段。`,
      binding.auth_mode === "api_key"
        ? "默认使用 x-api-key；若团队要转成其他 header，请放在受控代理层完成。"
        : "当前 binding 仍依赖 internal auth；这里只提供事实文档，不伪装成外部公共 API。"
    ]
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

function buildWorkflowApiRequestHeadersSummary(requestHeaders: string[]) {
  return requestHeaders.length > 0
    ? requestHeaders.join(" · ")
    : "no extra published header · internal auth / trusted proxy";
}

function buildWorkflowApiRequestHeadersCodeBlock(requestHeaders: string[]) {
  return requestHeaders.length > 0
    ? requestHeaders.join("\n")
    : "当前 published binding 不单独暴露 external API key；请通过 internal auth 或受控代理接入。";
}

function buildWorkflowApiEndpointDescription(
  binding: WorkflowPublishedEndpointItem,
  requestSurface: WorkflowApiRequestSurface
) {
  const streamingLabel = binding.streaming ? "当前 binding 已开启 streaming。" : "当前 binding 未开启 streaming。";

  return `${requestSurface.protocolLabel} 继续复用真实 published alias、route path 和 request path。${streamingLabel}`;
}

function buildWorkflowApiBindingSections(
  binding: WorkflowPublishedEndpointItem,
  requestSurface: WorkflowApiRequestSurface,
  anchorId: string
): WorkflowApiDocSection[] {
  return [
    {
      id: buildWorkflowApiSectionId(anchorId, "base-url"),
      navLabel: "基础 URL",
      eyebrow: "Base URL",
      title: "基础 URL",
      description: "先固定 host 与协议入口，再继续区分每个 published binding 的 request path。",
      metaRows: [
        { label: "Base URL", value: requestSurface.baseUrl },
        { label: "Request URL", value: requestSurface.requestUrl },
        { label: "HTTP method", value: "POST" }
      ],
      codeLabel: "Code",
      codeBlock: requestSurface.baseUrl
    },
    {
      id: buildWorkflowApiSectionId(anchorId, "auth"),
      navLabel: "鉴权",
      eyebrow: "Authentication",
      title: "鉴权",
      description: requestSurface.authDescription,
      metaRows: [
        { label: "Auth mode", value: binding.auth_mode },
        {
          label: "Request headers",
          value: buildWorkflowApiRequestHeadersSummary(requestSurface.requestHeaders)
        }
      ],
      codeLabel: "Request headers",
      codeBlock: buildWorkflowApiRequestHeadersCodeBlock(requestSurface.requestHeaders)
    },
    {
      id: buildWorkflowApiSectionId(anchorId, "endpoint"),
      navLabel: "Endpoint",
      eyebrow: "Endpoint contract",
      title: "Endpoint 入口",
      description: buildWorkflowApiEndpointDescription(binding, requestSurface),
      metaRows: [
        { label: "Protocol", value: requestSurface.protocolLabel },
        { label: "Published alias", value: binding.endpoint_alias },
        { label: "Route path", value: binding.route_path },
        { label: "Request path", value: requestSurface.requestPath },
        { label: "Streaming", value: binding.streaming ? "enabled" : "disabled" }
      ],
      codeLabel: "Request body",
      codeBlock: JSON.stringify(requestSurface.requestBody, null, 2)
    },
    {
      id: buildWorkflowApiSectionId(anchorId, "example"),
      navLabel: "最小请求示例",
      eyebrow: "Quick request",
      title: "最小请求示例",
      description:
        "继续复用真实 published binding 的 request URL、headers 和 body shape，先让团队完成一次最小请求闭环。",
      codeLabel: "cURL",
      codeBlock: buildCurlSnippet(requestSurface)
    },
    {
      id: buildWorkflowApiSectionId(anchorId, "protocol-diff"),
      navLabel: "协议差异",
      eyebrow: "Protocol notes",
      title: "协议差异",
      description:
        "把当前 binding 与其它 published protocols 的关键差异集中收口，避免回头翻 publish JSON 或 provider 配置页。",
      bulletItems: requestSurface.protocolDifferences
    }
  ];
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
  const anchorId = buildWorkflowApiAnchorId(binding);

  return {
    bindingId: binding.id,
    anchorId,
    title: binding.endpoint_name,
    endpointSummary: bindingSurface.endpointSummary,
    directorySummary: `${requestSurface.protocolLabel} · auth ${binding.auth_mode}`,
    protocolChips: bindingSurface.protocolChips,
    protocolLabel: requestSurface.protocolLabel,
    authModeLabel: binding.auth_mode,
    baseUrl: requestSurface.baseUrl,
    requestPath: requestSurface.requestPath,
    sections: buildWorkflowApiBindingSections(binding, requestSurface, anchorId)
  };
}
