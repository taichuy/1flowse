import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useEffect, type ReactNode } from 'react';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import {
  modelProviderOptionsProviders,
  modelProviderOptionsContract
} from '../../../test/model-provider-contract-fixtures';

const modelProviderOptionsApi = vi.hoisted(() => ({
  modelProviderOptionsQueryKey: ['model-providers', 'options'] as const,
  fetchModelProviderOptions: vi.fn()
}));

vi.mock('../api/model-provider-options', () => modelProviderOptionsApi);

import { createDefaultAgentFlowDocument } from '@1flowbase/flow-schema';
import { AppProviders } from '../../../app/AppProviders';
import { NodeConfigTab } from '../components/detail/tabs/NodeConfigTab';
import { AgentFlowEditorStoreProvider } from '../store/editor/AgentFlowEditorStoreProvider';
import { useAgentFlowEditorStore } from '../store/editor/provider';
import { selectWorkingDocument } from '../store/editor/selectors';

const primaryProviderOption = modelProviderOptionsProviders[0];
const primaryProviderFirstGroup = primaryProviderOption.model_groups[0];
const primaryProviderFirstModel = primaryProviderFirstGroup.models[0];
const primaryProviderSecondGroup = primaryProviderOption.model_groups[1];
const primaryProviderSecondModel = primaryProviderSecondGroup.models[0];
const secondaryProviderOption = modelProviderOptionsProviders[1];
const secondaryProviderFirstGroup = secondaryProviderOption.model_groups[0];
const secondaryProviderFirstModel = secondaryProviderFirstGroup.models[0];

function createInitialState() {
  return {
    flow_id: 'flow-1',
    draft: {
      id: 'draft-1',
      flow_id: 'flow-1',
      updated_at: '2026-04-18T10:00:00Z',
      document: createDefaultAgentFlowDocument({ flowId: 'flow-1' })
    },
    autosave_interval_seconds: 30,
    versions: []
  };
}

function DocumentObserver({
  onChange
}: {
  onChange: (
    document: ReturnType<typeof createDefaultAgentFlowDocument>
  ) => void;
}) {
  const document = useAgentFlowEditorStore(selectWorkingDocument);

  useEffect(() => {
    onChange(document);
  }, [document, onChange]);

  return null;
}

function renderWithProviders(ui: ReactNode) {
  return render(<AppProviders>{ui}</AppProviders>);
}

async function selectProviderOption(label: string) {
  const providerSelect = await screen.findByRole('combobox', {
    name: '模型供应商'
  });

  fireEvent.mouseDown(providerSelect);
  const [option] = await screen.findAllByText((_, element) => {
    if (!element) {
      return false;
    }

    return (
      element.matches('.ant-select-item-option-content') &&
      Boolean(element.textContent?.includes(label))
    );
  });
  fireEvent.click(option);
}

describe('LlmModelField', () => {
  beforeEach(() => {
    modelProviderOptionsApi.fetchModelProviderOptions.mockReset();
    modelProviderOptionsApi.fetchModelProviderOptions.mockResolvedValue(
      modelProviderOptionsContract
    );
  });

  test('writes selected provider code and model back to the llm node config', async () => {
    let latestDocument = createDefaultAgentFlowDocument({ flowId: 'flow-1' });

    const { container } = renderWithProviders(
      <AgentFlowEditorStoreProvider initialState={createInitialState()}>
        <DocumentObserver
          onChange={(document) => {
            latestDocument = document;
          }}
        />
        <NodeConfigTab />
      </AgentFlowEditorStoreProvider>
    );

    expect(container.querySelector('.agent-flow-model-field')).toBeNull();

    await selectProviderOption(primaryProviderOption.display_name);
    await waitFor(() => {
      expect(latestDocument.graph.nodes).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: 'node-llm',
            config: expect.objectContaining({
              model_provider: expect.objectContaining({
                provider_code: 'openai_compatible',
                source_instance_id: primaryProviderFirstGroup.source_instance_id,
                model_id: primaryProviderFirstModel.model_id
              })
            })
          })
        ])
      );
    });
    expect(screen.getByRole('button', { name: '模型设置' })).not.toHaveTextContent(
      primaryProviderFirstModel.display_name
    );
    fireEvent.click(screen.getByRole('button', { name: '模型设置' }));

    expect(await screen.findByRole('heading', { name: '生效模型' })).toBeInTheDocument();
    expect(screen.queryByPlaceholderText('搜索生效模型')).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: '模型供应商设置' })).not.toBeInTheDocument();
    fireEvent.mouseDown(screen.getByRole('combobox', { name: '生效模型' }));
    expect(
      await screen.findByText(primaryProviderFirstGroup.source_instance_display_name)
    ).toBeInTheDocument();
    expect(
      screen.getByText(primaryProviderSecondGroup.source_instance_display_name)
    ).toBeInTheDocument();
    const [nextModelOption] = await screen.findAllByText((_, element) => {
      if (!element) {
        return false;
      }

      return (
        element.matches('.ant-select-item-option-content') &&
        element.textContent?.trim() === primaryProviderSecondModel.display_name
      );
    });
    fireEvent.click(nextModelOption);

    await waitFor(() => {
      expect(latestDocument.graph.nodes).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: 'node-llm',
            config: expect.objectContaining({
              model_provider: expect.objectContaining({
                provider_code: 'openai_compatible',
                source_instance_id: primaryProviderSecondGroup.source_instance_id,
                model_id: primaryProviderSecondModel.model_id,
                provider_label: primaryProviderOption.display_name,
                model_label: primaryProviderSecondModel.display_name
              }),
              llm_parameters: {
                schema_version: '1.0.0',
                items: {}
              }
            })
          })
        ])
      );
    });
  }, 10_000);

  test('resolves parameter schema from the selected grouped model entry', async () => {
    const duplicatedModelContract = JSON.parse(
      JSON.stringify(modelProviderOptionsContract)
    ) as typeof modelProviderOptionsContract;
    const duplicatedProvider = duplicatedModelContract.providers[0];

    duplicatedProvider.model_groups = [
      {
        source_instance_id: 'provider-openai-prod',
        source_instance_display_name: 'OpenAI Production',
        models: [
          {
            ...primaryProviderFirstModel,
            model_id: 'gpt-4o-mini',
            display_name: 'GPT-4o Mini',
            parameter_form: {
              schema_version: '1.0.0',
              fields: [
                {
                  key: 'temperature',
                  label: 'Temperature',
                  type: 'number',
                  send_mode: 'optional',
                  enabled_by_default: false,
                  options: [],
                  visible_when: [],
                  disabled_when: [],
                  default_value: 0.7
                }
              ]
            }
          }
        ]
      },
      {
        source_instance_id: 'provider-openai-backup',
        source_instance_display_name: 'OpenAI Backup',
        models: [
          {
            ...primaryProviderFirstModel,
            model_id: 'gpt-4o-mini',
            display_name: 'GPT-4o Mini',
            parameter_form: {
              schema_version: '1.0.0',
              fields: [
                {
                  key: 'top_p',
                  label: 'Top P',
                  type: 'number',
                  send_mode: 'optional',
                  enabled_by_default: true,
                  options: [],
                  visible_when: [],
                  disabled_when: [],
                  default_value: 0.9
                }
              ]
            }
          }
        ]
      }
    ];
    modelProviderOptionsApi.fetchModelProviderOptions.mockResolvedValueOnce(
      duplicatedModelContract
    );

    const state = createInitialState();
    const llmNode = state.draft.document.graph.nodes.find((node) => node.id === 'node-llm');

    if (!llmNode) {
      throw new Error('expected default LLM node');
    }

    llmNode.config.model_provider = {
      provider_code: duplicatedProvider.provider_code,
      source_instance_id: 'provider-openai-backup',
      model_id: 'gpt-4o-mini',
      provider_label: duplicatedProvider.display_name,
      model_label: 'GPT-4o Mini'
    };

    renderWithProviders(
      <AgentFlowEditorStoreProvider initialState={state}>
        <NodeConfigTab />
      </AgentFlowEditorStoreProvider>
    );

    expect(await screen.findByText('Top P')).toBeInTheDocument();
    expect(screen.queryByText('Temperature')).not.toBeInTheDocument();
  });

  test('shows a formal error state when the current provider is unavailable', async () => {
    const state = createInitialState();
    const llmNode = state.draft.document.graph.nodes.find((node) => node.id === 'node-llm');

    if (!llmNode) {
      throw new Error('expected default LLM node');
    }

    llmNode.config.model_provider = {
      provider_code: 'provider_stale',
      source_instance_id: 'provider-stale-instance',
      model_id: 'gpt-4o-mini'
    };

    renderWithProviders(
      <AgentFlowEditorStoreProvider initialState={state}>
        <NodeConfigTab />
      </AgentFlowEditorStoreProvider>
    );

    fireEvent.click(screen.getByRole('button', { name: '模型设置' }));

    expect(
      await screen.findByText('当前节点引用的模型供应商不可用。')
    ).toBeInTheDocument();
  });

  test('resets to the new provider first enabled model when switching providers', async () => {
    let latestDocument = createDefaultAgentFlowDocument({ flowId: 'flow-1' });

    renderWithProviders(
      <AgentFlowEditorStoreProvider initialState={createInitialState()}>
        <DocumentObserver
          onChange={(document) => {
            latestDocument = document;
          }}
        />
        <NodeConfigTab />
      </AgentFlowEditorStoreProvider>
    );

    await selectProviderOption(secondaryProviderOption.display_name);

    await waitFor(() => {
      expect(latestDocument.graph.nodes).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: 'node-llm',
            config: expect.objectContaining({
              model_provider: expect.objectContaining({
                provider_code: secondaryProviderOption.provider_code,
                source_instance_id: secondaryProviderFirstGroup.source_instance_id,
                model_id: secondaryProviderFirstModel.model_id,
                provider_label: secondaryProviderOption.display_name,
                model_label: secondaryProviderFirstModel.display_name
              })
            })
          })
        ])
      );
    });
  });
});
