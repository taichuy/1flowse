import { describe, expect, it } from "vitest";

import {
  createDefaultModelProviderDraft,
  getCompatibleCredentials,
  getModelProviderCatalogItem,
  type NativeModelProviderCatalogItem
} from "@/lib/model-provider-registry";

const catalog: NativeModelProviderCatalogItem[] = [
  {
    id: "openai",
    label: "OpenAI",
    description: "OpenAI",
    help_url: null,
    supported_model_types: ["llm"],
    configuration_methods: ["predefined-model", "customizable-model"],
    credential_type: "openai_api_key",
    compatible_credential_types: ["openai_api_key", "api_key"],
    default_base_url: "https://api.openai.com/v1",
    default_protocol: "chat_completions",
    default_models: ["gpt-4.1"],
    credential_fields: []
  },
  {
    id: "anthropic",
    label: "Anthropic",
    description: "Anthropic",
    help_url: null,
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

const credentials = [
  {
    id: "cred-openai-1",
    name: "OpenAI Prod Key",
    credential_type: "openai_api_key",
    description: "",
    status: "active" as const,
    sensitivity_level: "L2" as const,
    sensitive_resource_id: null,
    last_used_at: null,
    revoked_at: null,
    created_at: "2026-03-31T12:00:00Z",
    updated_at: "2026-03-31T12:00:00Z"
  },
  {
    id: "cred-anthropic-1",
    name: "Claude Prod Key",
    credential_type: "anthropic_api_key",
    description: "",
    status: "active" as const,
    sensitivity_level: "L2" as const,
    sensitive_resource_id: null,
    last_used_at: null,
    revoked_at: null,
    created_at: "2026-03-31T12:00:00Z",
    updated_at: "2026-03-31T12:00:00Z"
  }
];

describe("model-provider-registry helpers", () => {
  it("filters credentials by provider compatibility", () => {
    const openai = getModelProviderCatalogItem(catalog, "openai");

    expect(getCompatibleCredentials(openai, credentials)).toHaveLength(1);
    expect(getCompatibleCredentials(openai, credentials)[0]?.id).toBe("cred-openai-1");
  });

  it("builds a default draft from the first catalog item", () => {
    expect(createDefaultModelProviderDraft(catalog, credentials)).toEqual(
      expect.objectContaining({
        provider_id: "openai",
        credential_ref: "credential://cred-openai-1",
        base_url: "https://api.openai.com/v1",
        default_model: "gpt-4.1"
      })
    );
  });
});
