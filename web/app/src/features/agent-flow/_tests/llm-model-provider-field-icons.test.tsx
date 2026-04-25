import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import { createDefaultAgentFlowDocument } from '@1flowbase/flow-schema';
import { AppProviders } from '../../../app/AppProviders';
import {
  modelProviderOptionsContract,
  modelProviderOptionsProviders
} from '../../../test/model-provider-contract-fixtures';
import * as modelProviderOptionsApi from '../api/model-provider-options';
import { NodeConfigTab } from '../components/detail/tabs/NodeConfigTab';
import { AgentFlowEditorStoreProvider } from '../store/editor/AgentFlowEditorStoreProvider';

const primaryProviderOption = modelProviderOptionsProviders[0];
const fetchModelProviderOptionsSpy = vi.spyOn(
  modelProviderOptionsApi,
  'fetchModelProviderOptions'
);

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

function renderWithProviders() {
  return render(
    <AppProviders>
      <AgentFlowEditorStoreProvider initialState={createInitialState()}>
        <NodeConfigTab />
      </AgentFlowEditorStoreProvider>
    </AppProviders>
  );
}

async function openModelSettings() {
  fireEvent.click(await screen.findByRole('button', { name: '模型' }));
  expect(
    await screen.findByRole('heading', { name: '模型设置' })
  ).toBeInTheDocument();
}

async function openModelDropdown() {
  const combobox = await screen.findByRole('combobox', {
    name: '选择供应商和模型'
  });

  fireEvent.mouseDown(combobox.closest('.ant-select-selector') ?? combobox);
  fireEvent.keyDown(combobox, { key: 'ArrowDown' });
}

describe('LlmModelField provider icons', () => {
  beforeEach(() => {
    fetchModelProviderOptionsSpy.mockReset();
    fetchModelProviderOptionsSpy.mockResolvedValue(
      modelProviderOptionsContract
    );
  });

  test('renders the provider logo in the dropdown provider header', async () => {
    renderWithProviders();

    await openModelSettings();
    await openModelDropdown();

    const providerHead = screen
      .getByText(primaryProviderOption.display_name)
      .closest('button');
    const providerIcon = providerHead?.querySelector(
      '.agent-flow-model-settings__provider-icon-image'
    );

    expect(providerIcon).toBeInstanceOf(HTMLImageElement);
    expect(providerIcon).toHaveAttribute('src', primaryProviderOption.icon);
  });
});
