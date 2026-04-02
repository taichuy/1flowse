import * as React from "react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("antd", async (importOriginal) => {
  const actual = await importOriginal<typeof import("antd")>();
  const { createElement: createReactElement } = await import("react");

  return {
    ...actual,
    Modal: ({ open, title, children }: { open?: boolean; title?: unknown; children?: unknown }) =>
      open
        ? createReactElement(
            "section",
            { "data-component": "workspace-model-provider-modal-shell" },
            title
              ? createReactElement(
                  "div",
                  {
                    "data-component": "workspace-model-provider-modal-title",
                    key: "title"
                  },
                  title as never
                )
              : null,
            children as never
          )
        : null
  };
});

import { WorkspaceModelProviderSettings } from "@/components/workspace-model-provider-settings";
import type { CredentialItem } from "@/lib/get-credentials";
import type {
  NativeModelProviderCatalogItem,
  WorkspaceModelProviderConfigItem
} from "@/lib/model-provider-registry";

Object.assign(globalThis, { React });

vi.mock("@/lib/model-provider-registry", async () => {
  const actual = await vi.importActual<typeof import("@/lib/model-provider-registry")>(
    "@/lib/model-provider-registry"
  );
  return {
    ...actual,
    createWorkspaceModelProviderConfig: vi.fn(),
    updateWorkspaceModelProviderConfig: vi.fn(),
    deactivateWorkspaceModelProviderConfig: vi.fn()
  };
});

function buildProps(): React.ComponentProps<typeof WorkspaceModelProviderSettings> {
  const initialCatalog: NativeModelProviderCatalogItem[] = [
      {
        id: "openai",
        label: "OpenAI",
        description: "OpenAI",
        help_url: "https://platform.openai.com/account/api-keys",
        supported_model_types: ["llm"],
        configuration_methods: ["predefined-model", "customizable-model"],
        credential_type: "openai_api_key",
        compatible_credential_types: ["openai_api_key", "api_key"],
        default_base_url: "https://api.openai.com/v1",
        default_protocol: "chat_completions",
        default_models: ["gpt-4.1"],
        credential_fields: [
          {
            variable: "api_protocol",
            label: "API Protocol",
            type: "select",
            required: false,
            placeholder: "",
            help: "Use Chat Completions for most OpenAI models.",
            default: "chat_completions",
            options: [
              {
                value: "chat_completions",
                label: "Chat Completions"
              },
              {
                value: "responses",
                label: "Responses API"
              }
            ]
          }
        ]
      },
      {
        id: "anthropic",
        label: "Anthropic",
        description: "Claude native provider",
        help_url: "https://console.anthropic.com/account/keys",
        supported_model_types: ["llm"],
        configuration_methods: ["predefined-model", "customizable-model"],
        credential_type: "anthropic_api_key",
        compatible_credential_types: ["anthropic_api_key", "api_key"],
        default_base_url: "https://api.anthropic.com",
        default_protocol: "messages",
        default_models: ["claude-3-7-sonnet-latest"],
        credential_fields: []
      }
  ];
  const initialCredentials: CredentialItem[] = [
      {
        id: "cred-openai-1",
        name: "OpenAI Prod Key",
        credential_type: "openai_api_key",
        description: "",
        status: "active",
        sensitivity_level: "L2",
        sensitive_resource_id: null,
        last_used_at: null,
        revoked_at: null,
        created_at: "2026-03-31T12:00:00Z",
        updated_at: "2026-03-31T12:00:00Z"
      },
      {
        id: "cred-anthropic-1",
        name: "Claude Team Key",
        credential_type: "anthropic_api_key",
        description: "",
        status: "active",
        sensitivity_level: "L2",
        sensitive_resource_id: null,
        last_used_at: null,
        revoked_at: null,
        created_at: "2026-03-31T12:00:00Z",
        updated_at: "2026-03-31T12:00:00Z"
      }
  ];
  const initialProviderConfigs: WorkspaceModelProviderConfigItem[] = [
      {
        id: "provider-openai-1",
        workspace_id: "default",
        provider_id: "openai",
        provider_label: "OpenAI",
        label: "OpenAI Production",
        description: "主团队供应商",
        credential_id: "cred-openai-1",
        credential_ref: "credential://cred-openai-1",
        credential_name: "OpenAI Prod Key",
        credential_type: "openai_api_key",
        base_url: "https://api.openai.com/v1",
        default_model: "gpt-4.1",
        protocol: "responses",
        status: "active",
        supported_model_types: ["llm"],
        created_at: "2026-03-31T12:00:00Z",
        updated_at: "2026-03-31T12:00:00Z",
        disabled_at: null
      }
  ];

  return {
    workspaceName: "7Flows Workspace",
    initialCatalog,
    initialCredentials,
    initialProviderConfigs
  };
}

describe("WorkspaceModelProviderSettings", () => {
  it("renders provider cards instead of the old registry list and split form", () => {
    const html = renderToStaticMarkup(
      createElement(WorkspaceModelProviderSettings, buildProps())
    );

    expect(html).toContain('data-component="workspace-model-provider-settings"');
    expect(html).toContain('data-component="workspace-model-provider-catalog-card"');
    expect(html).toContain('data-component="workspace-model-provider-registry-directory"');
    expect(html).toContain('data-component="workspace-model-provider-registry-card"');
    expect(html).not.toContain('data-component="workspace-model-provider-registry-list"');
    expect(html).not.toContain('data-component="workspace-model-provider-form"');
    expect(html).toContain("OpenAI Production");
    expect(html).toContain("credential://cred-openai-1");
    expect(html).toContain("查看 OpenAI 帮助文档");
    expect(html).toContain("当前只开放创建、编辑与停用；delete / duplicate / marketplace sync 仍未接入");
    expect(html).toContain("创建供应商配置");
  });

  it("can render a create modal seeded from a provider card", () => {
    const html = renderToStaticMarkup(
      createElement(WorkspaceModelProviderSettings, {
        ...buildProps(),
        initialModalState: {
          kind: "create",
          providerId: "anthropic"
        }
      })
    );

    expect(html).toContain('data-component="workspace-model-provider-modal-shell"');
    expect(html).toContain('data-component="workspace-model-provider-modal"');
    expect(html).toContain('data-modal-mode="create"');
    expect(html).toContain("新增供应商配置");
    expect(html).toContain("Anthropic");
    expect(html).toContain("claude-3-7-sonnet-latest");
    expect(html).toContain("Claude Team Key · anthropic_api_key");
    expect(html).toContain('data-component="workspace-model-provider-preflight"');
    expect(html).toContain("创建供应商");
  });

  it("can render an edit modal that reuses the existing provider draft", () => {
    const html = renderToStaticMarkup(
      createElement(WorkspaceModelProviderSettings, {
        ...buildProps(),
        initialModalState: {
          kind: "edit",
          providerConfigId: "provider-openai-1"
        }
      })
    );

    expect(html).toContain('data-component="workspace-model-provider-modal-shell"');
    expect(html).toContain('data-modal-mode="edit"');
    expect(html).toContain("更新供应商配置");
    expect(html).toContain("OpenAI Production");
    expect(html).toContain("credential://cred-openai-1");
    expect(html).toContain("Responses API");
    expect(html).toContain("保存变更");
  });
});
