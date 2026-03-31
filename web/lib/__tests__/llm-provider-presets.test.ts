import { describe, expect, it } from "vitest";

import {
  getNativeLlmProviderPreset,
  listNativeLlmProviderPresets
} from "@/lib/llm-provider-presets";
import type { NativeModelProviderCatalogItem } from "@/lib/model-provider-registry";

const catalog: NativeModelProviderCatalogItem[] = [
  {
    id: "openai",
    label: "OpenAI",
    description: "OpenAI from provider catalog",
    help_url: null,
    supported_model_types: ["llm"],
    configuration_methods: ["predefined-model", "customizable-model"],
    credential_type: "openai_api_key",
    compatible_credential_types: ["openai_api_key", "api_key"],
    default_base_url: "https://proxy.openai.local/v1",
    default_protocol: "chat_completions",
    default_models: ["gpt-4.1", "gpt-4o-mini"],
    credential_fields: []
  },
  {
    id: "anthropic",
    label: "Anthropic",
    description: "Anthropic from provider catalog",
    help_url: null,
    supported_model_types: ["llm"],
    configuration_methods: ["predefined-model", "customizable-model"],
    credential_type: "anthropic_api_key",
    compatible_credential_types: ["anthropic_api_key", "api_key"],
    default_base_url: "https://proxy.anthropic.local",
    default_protocol: "messages",
    default_models: ["claude-3-7-sonnet-latest"],
    credential_fields: []
  }
];

describe("llm-provider-presets", () => {
  it("builds native presets from provider catalog data", () => {
    const preset = getNativeLlmProviderPreset("openai", catalog);

    expect(preset).toMatchObject({
      providerValue: "openai",
      defaultBaseUrl: "https://proxy.openai.local/v1",
      modelPlaceholder: "gpt-4.1 / gpt-4o-mini",
      description: "OpenAI from provider catalog"
    });
  });

  it("keeps legacy openai-compatible preset after native catalog presets", () => {
    const presets = listNativeLlmProviderPresets(catalog);

    expect(presets.map((item) => item.id)).toEqual([
      "openai",
      "anthropic",
      "openai-compatible"
    ]);
  });
});
