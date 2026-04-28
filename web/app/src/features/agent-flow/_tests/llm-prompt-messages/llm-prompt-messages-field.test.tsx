import { fireEvent, render, screen, within } from '@testing-library/react';
import { useEffect, type ReactNode } from 'react';
import { describe, expect, test } from 'vitest';

import {
  createDefaultAgentFlowDocument,
  type LlmPromptMessage
} from '@1flowbase/flow-schema';

import { AppProviders } from '../../../../app/AppProviders';
import { NodeConfigTab } from '../../components/detail/tabs/NodeConfigTab';
import { AgentFlowEditorStoreProvider } from '../../store/editor/AgentFlowEditorStoreProvider';
import { useAgentFlowEditorStore } from '../../store/editor/provider';
import { selectWorkingDocument } from '../../store/editor/selectors';

function createInitialState(
  document = createDefaultAgentFlowDocument({ flowId: 'flow-1' })
) {
  return {
    flow_id: 'flow-1',
    draft: {
      id: 'draft-1',
      flow_id: 'flow-1',
      updated_at: '2026-04-28T10:00:00Z',
      document
    },
    autosave_interval_seconds: 30,
    versions: []
  };
}

function renderWithProviders(ui: ReactNode) {
  return render(<AppProviders>{ui}</AppProviders>);
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

function SelectionSeed({ nodeId }: { nodeId: string }) {
  const setSelection = useAgentFlowEditorStore((state) => state.setSelection);

  useEffect(() => {
    setSelection({
      selectedNodeId: nodeId,
      selectedNodeIds: [nodeId]
    });
  }, [nodeId, setSelection]);

  return null;
}

function llmNodeFrom(document: ReturnType<typeof createDefaultAgentFlowDocument>) {
  const node = document.graph.nodes.find((entry) => entry.id === 'node-llm');

  if (!node) {
    throw new Error('expected default LLM node');
  }

  return node;
}

function promptMessagesFrom(
  document: ReturnType<typeof createDefaultAgentFlowDocument>
): LlmPromptMessage[] {
  const promptMessages = llmNodeFrom(document).bindings.prompt_messages;

  if (promptMessages?.kind !== 'prompt_messages') {
    throw new Error('expected prompt_messages binding');
  }

  return promptMessages.value;
}

describe('LLM prompt messages field', () => {
  test('renders default prompt messages and writes add role delete and drag changes', async () => {
    let latestDocument = createDefaultAgentFlowDocument({ flowId: 'flow-1' });

    renderWithProviders(
      <AgentFlowEditorStoreProvider initialState={createInitialState()}>
        <SelectionSeed nodeId="node-llm" />
        <DocumentObserver
          onChange={(document) => {
            latestDocument = document;
          }}
        />
        <NodeConfigTab />
      </AgentFlowEditorStoreProvider>
    );

    expect(await screen.findByText('上下文')).toBeInTheDocument();
    expect(screen.getByLabelText('SYSTEM 消息内容')).toBeInTheDocument();
    expect(screen.getByLabelText('USER 消息内容')).toBeInTheDocument();
    expect(promptMessagesFrom(latestDocument)[1]?.content.value).toBe(
      '{{node-start.query}}'
    );

    fireEvent.click(screen.getByRole('button', { name: '添加消息' }));
    expect(screen.getAllByLabelText('USER 消息内容')).toHaveLength(2);

    const rows = screen.getAllByTestId(/llm-prompt-message-row-/);
    const addedRow = rows.at(-1);

    if (!addedRow) {
      throw new Error('expected appended prompt message row');
    }

    fireEvent.change(
      within(addedRow).getByRole('combobox', { name: /消息角色/ }),
      { target: { value: 'assistant' } }
    );

    fireEvent.dragStart(
      within(rows[0]).getByRole('button', { name: /拖拽排序/ })
    );
    fireEvent.dragOver(addedRow);
    fireEvent.drop(addedRow);

    fireEvent.click(within(addedRow).getByRole('button', { name: /删除/ }));

    expect(promptMessagesFrom(latestDocument).map((message) => message.role)).toEqual([
      'user',
      'system'
    ]);
  });

  test('renders legacy system and user prompt bindings as prompt messages', async () => {
    const document = createDefaultAgentFlowDocument({ flowId: 'flow-1' });
    document.graph.nodes = document.graph.nodes.map((node) =>
      node.id === 'node-llm'
        ? {
            ...node,
            bindings: {
              system_prompt: {
                kind: 'templated_text',
                value: 'You are helpful.'
              },
              user_prompt: {
                kind: 'selector',
                value: ['node-start', 'query']
              }
            }
          }
        : node
    );

    renderWithProviders(
      <AgentFlowEditorStoreProvider initialState={createInitialState(document)}>
        <SelectionSeed nodeId="node-llm" />
        <NodeConfigTab />
      </AgentFlowEditorStoreProvider>
    );

    expect(await screen.findByLabelText('SYSTEM 消息内容')).toBeInTheDocument();
    expect(screen.getByText('You are helpful.')).toBeInTheDocument();
    expect(screen.getByLabelText('USER 消息内容')).toBeInTheDocument();
  });
});
