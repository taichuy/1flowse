import { describe, expect, test } from 'vitest';

import {
  DEFAULT_LLM_PARAMETERS,
  getLlmParameterDefaultValue,
  getLlmModelProvider,
  getLlmParameters
} from '../lib/llm-node-config';

describe('llm-node-config', () => {
  test('getLlmModelProvider only reads the current model_provider contract', () => {
    expect(
      getLlmModelProvider({
        provider_code: 'legacy_provider',
        model: 'legacy-model',
        protocol: 'legacy'
      })
    ).toEqual({
      provider_code: '',
      source_instance_id: '',
      model_id: '',
      protocol: undefined,
      provider_label: undefined,
      model_label: undefined,
      schema_fetched_at: undefined
    });
  });

  test('getLlmModelProvider reads source_instance_id from the nested contract', () => {
    expect(
      getLlmModelProvider({
        model_provider: {
          provider_code: 'openai_compatible',
          source_instance_id: 'provider-1',
          model_id: 'gpt-4o-mini',
          protocol: 'openai_compatible',
          provider_label: 'OpenAI Compatible',
          model_label: 'gpt-4o-mini',
          schema_fetched_at: '2026-04-23T10:00:00Z'
        }
      })
    ).toEqual({
      provider_code: 'openai_compatible',
      source_instance_id: 'provider-1',
      model_id: 'gpt-4o-mini',
      protocol: 'openai_compatible',
      provider_label: 'OpenAI Compatible',
      model_label: 'gpt-4o-mini',
      schema_fetched_at: '2026-04-23T10:00:00Z'
    });
  });

  test('getLlmParameters ignores legacy flat parameter fields', () => {
    expect(
      getLlmParameters({
        temperature: 0.7,
        top_p_enabled: true,
        top_p: 0.9,
        max_tokens_enabled: true,
        max_tokens: 1024
      })
    ).toEqual(DEFAULT_LLM_PARAMETERS);
  });

  test('getLlmParameterDefaultValue derives stable defaults when schema omits them', () => {
    expect(
      getLlmParameterDefaultValue({
        key: 'temperature',
        label: 'Temperature',
        type: 'number',
        required: false,
        advanced: false,
        options: [],
        visible_when: [],
        disabled_when: []
      })
    ).toBe(0);
    expect(
      getLlmParameterDefaultValue({
        key: 'stop',
        label: 'Stop',
        type: 'string_list',
        required: false,
        advanced: false,
        options: [],
        visible_when: [],
        disabled_when: []
      })
    ).toEqual([]);
  });
});
