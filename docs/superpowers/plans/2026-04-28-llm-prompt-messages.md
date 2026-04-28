# LLM Prompt Messages Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade LLM node prompt configuration from fixed `system_prompt + user_prompt` fields to an ordered `SYSTEM / USER / ASSISTANT` message list that is editable in the Inspector and used by backend runtime.

**Architecture:** Add `prompt_messages` as a new `FlowBinding` kind with compatibility readers for legacy `system_prompt` and `user_prompt`. The frontend gets one LLM-specific field renderer and component, while the backend compiler and runtime render the ordered messages into the current provider invocation contract. Default app creation keeps `SYSTEM + USER(Start.query)`, while manually inserted LLM nodes seed only an empty `SYSTEM`.

**Tech Stack:** TypeScript, React 19, Ant Design 5, Lexical templated editor, Vitest, Rust, serde_json, cargo tests.

---

## File Structure

- Modify `web/packages/flow-schema/src/index.ts`
  - Add `LlmPromptMessageRole`, `LlmPromptMessage`, `FlowBinding` union support for `prompt_messages`.
  - Change `createDefaultAgentFlowDocument()` default LLM bindings to `prompt_messages`.
- Modify `web/app/src/features/agent-flow/lib/document/node-factory.ts`
  - Seed manually created LLM nodes with only an empty `SYSTEM` `prompt_messages` binding.
- Create `web/app/src/features/agent-flow/lib/llm-prompt-messages.ts`
  - Normalize new and legacy prompt bindings for UI rendering.
  - Create stable prompt message ids and default prompt message rows.
- Modify `web/app/src/features/agent-flow/lib/node-definitions/types.ts`
  - Add `llm_prompt_messages` editor kind.
- Modify `web/app/src/features/agent-flow/lib/node-definitions/nodes/llm.ts`
  - Replace `bindings.system_prompt` and `bindings.user_prompt` field definitions with `bindings.prompt_messages`.
- Create `web/app/src/features/agent-flow/components/detail/fields/LlmPromptMessagesField.tsx`
  - Render ordered message rows with drag handle, role selector, `TemplatedTextField`, delete, and add.
- Modify `web/app/src/features/agent-flow/schema/node-schema-fragments.ts`
  - Map `llm_prompt_messages` editor to renderer key.
- Modify `web/app/src/features/agent-flow/schema/agent-flow-field-renderers.tsx`
  - Register `llm_prompt_messages` renderer and write normalized `prompt_messages` bindings.
- Modify `web/app/src/features/agent-flow/components/editor/styles/inspector.css`
  - Add bounded styles for prompt message rows.
- Create `web/app/src/features/agent-flow/_tests/llm-prompt-messages/llm-prompt-messages-field.test.tsx`
  - Cover default app template UI, legacy UI compatibility, add/delete/role switch/drag behavior.
- Modify `web/app/src/features/agent-flow/_tests/agent-flow-document.test.ts`
  - Cover default application document prompt messages.
- Modify `web/app/src/features/agent-flow/_tests/document-transforms.test.ts`
  - Cover manually inserted LLM node prompt messages.
- Modify `api/crates/orchestration-runtime/src/compiler.rs`
  - Extract selector paths from `prompt_messages` message content.
- Modify `api/crates/orchestration-runtime/src/binding_runtime.rs`
  - Resolve and render `prompt_messages`.
- Modify `api/crates/orchestration-runtime/src/execution_engine.rs`
  - Build provider input from ordered `prompt_messages`, with legacy fallback.
- Modify `api/crates/orchestration-runtime/src/_tests/compiler_tests.rs`
  - Cover compile-time selector extraction for `prompt_messages`.
- Modify `api/crates/orchestration-runtime/src/_tests/execution_engine_tests.rs`
  - Cover provider invocation order, assistant messages, merged system text, and legacy fallback.

---

### Task 1: Schema And Default Documents

**Files:**
- Modify: `web/packages/flow-schema/src/index.ts`
- Modify: `web/app/src/features/agent-flow/lib/document/node-factory.ts`
- Test: `web/app/src/features/agent-flow/_tests/agent-flow-document.test.ts`
- Test: `web/app/src/features/agent-flow/_tests/document-transforms.test.ts`

- [ ] **Step 1: Write the failing default document test**

Add this test to `web/app/src/features/agent-flow/_tests/agent-flow-document.test.ts`:

```ts
test('seeds default LLM prompt messages with Start query user context', () => {
  const document = createDefaultAgentFlowDocument({ flowId: 'flow-1' });
  const llmNode = document.graph.nodes.find((node) => node.id === 'node-llm');

  expect(llmNode?.bindings.prompt_messages).toEqual({
    kind: 'prompt_messages',
    value: [
      {
        id: 'system-1',
        role: 'system',
        content: { kind: 'templated_text', value: '' }
      },
      {
        id: 'user-1',
        role: 'user',
        content: {
          kind: 'templated_text',
          value: '{{node-start.query}}'
        }
      }
    ]
  });
  expect(llmNode?.bindings).not.toHaveProperty('user_prompt');
});
```

- [ ] **Step 2: Write the failing manual LLM node test**

Add imports and this test to `web/app/src/features/agent-flow/_tests/document-transforms.test.ts`:

```ts
import { createNodeDocument } from '../lib/document/node-factory';

test('manual LLM nodes seed only an empty system prompt message', () => {
  const node = createNodeDocument('llm', 'node-llm-2');

  expect(node.bindings.prompt_messages).toEqual({
    kind: 'prompt_messages',
    value: [
      {
        id: 'system-1',
        role: 'system',
        content: { kind: 'templated_text', value: '' }
      }
    ]
  });
  expect(node.bindings).not.toHaveProperty('user_prompt');
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run:

```bash
pnpm --dir web/app test:fast src/features/agent-flow/_tests/agent-flow-document.test.ts src/features/agent-flow/_tests/document-transforms.test.ts
```

Expected: both new tests fail because `prompt_messages` is not in the schema/default document yet and manual LLM nodes currently have empty bindings.

- [ ] **Step 4: Implement the schema contract**

Modify `web/packages/flow-schema/src/index.ts`:

```ts
export type LlmPromptMessageRole = 'system' | 'user' | 'assistant';

export interface LlmPromptMessage {
  id: string;
  role: LlmPromptMessageRole;
  content: {
    kind: 'templated_text';
    value: string;
  };
}

export type FlowBinding =
  | { kind: 'templated_text'; value: string }
  | { kind: 'selector'; value: string[] }
  | { kind: 'selector_list'; value: string[][] }
  | {
      kind: 'prompt_messages';
      value: LlmPromptMessage[];
    }
  | {
      kind: 'named_bindings';
      value: Array<{ name: string; selector: string[] }>;
    }
  | {
      kind: 'condition_group';
      value: {
        operator: 'and' | 'or';
        conditions: Array<{
          left: string[];
          comparator: 'exists' | 'equals' | 'contains';
          right?: string | string[];
        }>;
      };
    }
  | {
      kind: 'state_write';
      value: Array<{
        path: string[];
        operator: 'set' | 'append' | 'clear' | 'increment';
        source: string[] | null;
      }>;
    };
```

Then update the default `node-llm` bindings:

```ts
bindings: {
  prompt_messages: {
    kind: 'prompt_messages',
    value: [
      {
        id: 'system-1',
        role: 'system',
        content: { kind: 'templated_text', value: '' }
      },
      {
        id: 'user-1',
        role: 'user',
        content: {
          kind: 'templated_text',
          value: '{{node-start.query}}'
        }
      }
    ]
  }
},
```

- [ ] **Step 5: Implement manual LLM node defaults**

Modify `web/app/src/features/agent-flow/lib/document/node-factory.ts` so the final `return` uses default bindings:

```ts
function defaultBindings(
  nodeType: BuiltinFlowNodeType
): FlowNodeDocument['bindings'] {
  if (nodeType !== 'llm') {
    return {};
  }

  return {
    prompt_messages: {
      kind: 'prompt_messages',
      value: [
        {
          id: 'system-1',
          role: 'system',
          content: { kind: 'templated_text', value: '' }
        }
      ]
    }
  };
}
```

Use it in `createNodeDocument()`:

```ts
return {
  id,
  type: nodeTypeOrOption,
  alias: humanizeNodeType(nodeTypeOrOption),
  description: '',
  containerId: null,
  position: { x, y },
  configVersion: 1,
  config: defaultConfig(nodeTypeOrOption),
  bindings: defaultBindings(nodeTypeOrOption),
  outputs: defaultOutputs(nodeTypeOrOption)
};
```

- [ ] **Step 6: Run tests to verify they pass**

Run:

```bash
pnpm --dir web/app test:fast src/features/agent-flow/_tests/agent-flow-document.test.ts src/features/agent-flow/_tests/document-transforms.test.ts
```

Expected: PASS for both files.

- [ ] **Step 7: Commit**

```bash
git add web/packages/flow-schema/src/index.ts web/app/src/features/agent-flow/lib/document/node-factory.ts web/app/src/features/agent-flow/_tests/agent-flow-document.test.ts web/app/src/features/agent-flow/_tests/document-transforms.test.ts
git commit -m "feat: add llm prompt message schema defaults"
```

---

### Task 2: LLM Prompt Messages Inspector UI

**Files:**
- Create: `web/app/src/features/agent-flow/lib/llm-prompt-messages.ts`
- Create: `web/app/src/features/agent-flow/components/detail/fields/LlmPromptMessagesField.tsx`
- Create: `web/app/src/features/agent-flow/_tests/llm-prompt-messages/llm-prompt-messages-field.test.tsx`
- Modify: `web/app/src/features/agent-flow/lib/node-definitions/types.ts`
- Modify: `web/app/src/features/agent-flow/lib/node-definitions/nodes/llm.ts`
- Modify: `web/app/src/features/agent-flow/schema/node-schema-fragments.ts`
- Modify: `web/app/src/features/agent-flow/schema/agent-flow-field-renderers.tsx`
- Modify: `web/app/src/features/agent-flow/components/editor/styles/inspector.css`

- [ ] **Step 1: Write the failing UI test file**

Create `web/app/src/features/agent-flow/_tests/llm-prompt-messages/llm-prompt-messages-field.test.tsx`:

```tsx
import { fireEvent, render, screen, within } from '@testing-library/react';
import { useEffect, type ReactNode } from 'react';
import { describe, expect, test } from 'vitest';

import { createDefaultAgentFlowDocument } from '@1flowbase/flow-schema';
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

function llmNodeFrom(document: ReturnType<typeof createDefaultAgentFlowDocument>) {
  const node = document.graph.nodes.find((entry) => entry.id === 'node-llm');

  if (!node) {
    throw new Error('expected default LLM node');
  }

  return node;
}

describe('LLM prompt messages field', () => {
  test('renders default prompt messages and writes add role delete and drag changes', async () => {
    let latestDocument = createDefaultAgentFlowDocument({ flowId: 'flow-1' });

    renderWithProviders(
      <AgentFlowEditorStoreProvider initialState={createInitialState()}>
        <DocumentObserver onChange={(document) => { latestDocument = document; }} />
        <NodeConfigTab />
      </AgentFlowEditorStoreProvider>
    );

    expect(await screen.findByText('上下文')).toBeInTheDocument();
    expect(screen.getByLabelText('SYSTEM 消息内容')).toBeInTheDocument();
    expect(screen.getByLabelText('USER 消息内容')).toBeInTheDocument();
    expect(screen.getByText('node-start.query')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '添加消息' }));
    expect(screen.getAllByLabelText('USER 消息内容')).toHaveLength(2);

    const rows = screen.getAllByTestId(/llm-prompt-message-row-/);
    const addedRow = rows.at(-1);

    if (!addedRow) {
      throw new Error('expected appended prompt message row');
    }

    fireEvent.mouseDown(within(addedRow).getByRole('combobox', { name: /消息角色/ }));
    fireEvent.click(await screen.findByTitle('ASSISTANT'));

    fireEvent.dragStart(within(rows[0]).getByRole('button', { name: /拖拽排序/ }));
    fireEvent.dragOver(addedRow);
    fireEvent.drop(addedRow);

    fireEvent.click(within(addedRow).getByRole('button', { name: /删除/ }));

    const promptMessages = llmNodeFrom(latestDocument).bindings.prompt_messages;
    expect(promptMessages).toEqual(
      expect.objectContaining({
        kind: 'prompt_messages',
        value: expect.any(Array)
      })
    );
    expect(promptMessages?.value.map((message) => message.role)).toEqual([
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
        <NodeConfigTab />
      </AgentFlowEditorStoreProvider>
    );

    expect(await screen.findByLabelText('SYSTEM 消息内容')).toBeInTheDocument();
    expect(screen.getByText('You are helpful.')).toBeInTheDocument();
    expect(screen.getByLabelText('USER 消息内容')).toBeInTheDocument();
    expect(screen.getByText('node-start.query')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the UI test to verify it fails**

Run:

```bash
pnpm --dir web/app test:fast src/features/agent-flow/_tests/llm-prompt-messages/llm-prompt-messages-field.test.tsx
```

Expected: FAIL because the test file imports paths that exist, but the LLM prompt message renderer and component are not implemented.

- [ ] **Step 3: Add prompt message helpers**

Create `web/app/src/features/agent-flow/lib/llm-prompt-messages.ts`:

```ts
import type {
  FlowBinding,
  LlmPromptMessage,
  LlmPromptMessageRole
} from '@1flowbase/flow-schema';

import { createTemplateSelectorToken } from './template-binding';

export const LLM_PROMPT_MESSAGE_ROLES: LlmPromptMessageRole[] = [
  'system',
  'user',
  'assistant'
];

export function createPromptMessage(
  role: LlmPromptMessageRole,
  index: number,
  value = ''
): LlmPromptMessage {
  return {
    id: `${role}-${index + 1}`,
    role,
    content: {
      kind: 'templated_text',
      value
    }
  };
}

function isFlowBinding(value: unknown): value is FlowBinding {
  return Boolean(value && typeof value === 'object' && 'kind' in value);
}

function legacyBindingToText(value: unknown) {
  if (!isFlowBinding(value)) {
    return '';
  }

  if (value.kind === 'templated_text') {
    return value.value;
  }

  if (value.kind === 'selector') {
    return createTemplateSelectorToken(value.value);
  }

  return '';
}

export function normalizePromptMessagesBinding(
  promptMessages: unknown,
  legacySystemPrompt: unknown,
  legacyUserPrompt: unknown
): LlmPromptMessage[] {
  if (
    isFlowBinding(promptMessages) &&
    promptMessages.kind === 'prompt_messages' &&
    Array.isArray(promptMessages.value)
  ) {
    return promptMessages.value.map((message, index) => ({
      id: message.id || `${message.role}-${index + 1}`,
      role: LLM_PROMPT_MESSAGE_ROLES.includes(message.role)
        ? message.role
        : 'user',
      content: {
        kind: 'templated_text',
        value:
          message.content?.kind === 'templated_text'
            ? message.content.value
            : ''
      }
    }));
  }

  const messages: LlmPromptMessage[] = [];
  const systemText = legacyBindingToText(legacySystemPrompt);
  const userText = legacyBindingToText(legacyUserPrompt);

  if (systemText || legacySystemPrompt) {
    messages.push(createPromptMessage('system', messages.length, systemText));
  }

  if (userText || legacyUserPrompt) {
    messages.push(createPromptMessage('user', messages.length, userText));
  }

  return messages.length > 0
    ? messages
    : [createPromptMessage('system', 0)];
}

export function toPromptMessagesBinding(messages: LlmPromptMessage[]): FlowBinding {
  return {
    kind: 'prompt_messages',
    value: messages.map((message, index) => ({
      id: message.id || `${message.role}-${index + 1}`,
      role: message.role,
      content: {
        kind: 'templated_text',
        value: message.content.value
      }
    }))
  };
}
```

- [ ] **Step 4: Add editor kind and node definition**

Modify `web/app/src/features/agent-flow/lib/node-definitions/types.ts`:

```ts
export type NodeEditorKind =
  | 'text'
  | 'llm_model'
  | 'llm_prompt_messages'
  | 'llm_response_format'
  | 'number'
  | 'selector'
  | 'selector_list'
  | 'templated_text'
  | 'named_bindings'
  | 'condition_group'
  | 'state_write'
  | 'output_contract_definition'
  | 'start_input_fields';
```

Modify `web/app/src/features/agent-flow/lib/node-definitions/nodes/llm.ts` inputs fields:

```ts
{
  key: 'bindings.prompt_messages',
  label: '上下文',
  editor: 'llm_prompt_messages'
}
```

Remove the old `bindings.system_prompt` and `bindings.user_prompt` field definitions from the LLM node definition.

- [ ] **Step 5: Register the renderer**

Modify `web/app/src/features/agent-flow/schema/node-schema-fragments.ts`:

```ts
const FIELD_RENDERER_BY_EDITOR: Record<NodeEditorKind, string> = {
  text: 'text',
  llm_model: 'llm_model',
  llm_prompt_messages: 'llm_prompt_messages',
  llm_response_format: 'llm_response_format',
  number: 'number',
  selector: 'selector',
  selector_list: 'selector_list',
  templated_text: 'templated_text',
  named_bindings: 'named_bindings',
  condition_group: 'condition_group',
  state_write: 'state_write',
  output_contract_definition: 'output_contract_definition',
  start_input_fields: 'start_input_fields'
};
```

- [ ] **Step 6: Create the prompt messages component**

Create `web/app/src/features/agent-flow/components/detail/fields/LlmPromptMessagesField.tsx`:

```tsx
import {
  DeleteOutlined,
  HolderOutlined,
  PlusOutlined
} from '@ant-design/icons';
import { Button, Empty, Select, Typography } from 'antd';
import { useState } from 'react';

import type {
  LlmPromptMessage,
  LlmPromptMessageRole
} from '@1flowbase/flow-schema';

import { TemplatedTextField } from '../../bindings/TemplatedTextField';
import type { FlowSelectorOption } from '../../../lib/selector-options';
import {
  createPromptMessage,
  LLM_PROMPT_MESSAGE_ROLES
} from '../../../lib/llm-prompt-messages';

interface LlmPromptMessagesFieldProps {
  value: LlmPromptMessage[];
  options: FlowSelectorOption[];
  onChange: (value: LlmPromptMessage[]) => void;
}

function moveItem<T>(items: T[], from: number, to: number) {
  if (from === to || from < 0 || to < 0 || from >= items.length || to >= items.length) {
    return items;
  }

  const nextItems = [...items];
  const [item] = nextItems.splice(from, 1);

  if (!item) {
    return items;
  }

  nextItems.splice(to, 0, item);
  return nextItems;
}

function updateAt(
  messages: LlmPromptMessage[],
  index: number,
  patch: Partial<LlmPromptMessage>
) {
  return messages.map((message, messageIndex) =>
    messageIndex === index ? { ...message, ...patch } : message
  );
}

export function LlmPromptMessagesField({
  value,
  options,
  onChange
}: LlmPromptMessagesFieldProps) {
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);

  function addMessage() {
    onChange([...value, createPromptMessage('user', value.length)]);
  }

  function updateRole(index: number, role: LlmPromptMessageRole) {
    onChange(updateAt(value, index, { role }));
  }

  function updateContent(index: number, nextValue: string) {
    onChange(
      value.map((message, messageIndex) =>
        messageIndex === index
          ? {
              ...message,
              content: { kind: 'templated_text', value: nextValue }
            }
          : message
      )
    );
  }

  function removeMessage(index: number) {
    onChange(value.filter((_, messageIndex) => messageIndex !== index));
  }

  function handleDrop(targetIndex: number) {
    if (draggingIndex === null) {
      return;
    }

    onChange(moveItem(value, draggingIndex, targetIndex));
    setDraggingIndex(null);
  }

  return (
    <div className="agent-flow-llm-prompt-messages">
      <div className="agent-flow-llm-prompt-messages__header">
        <Typography.Text className="agent-flow-node-detail__section-subtitle">
          按顺序发送给模型的上下文消息
        </Typography.Text>
        <Button
          aria-label="添加消息"
          icon={<PlusOutlined />}
          size="small"
          type="text"
          onClick={addMessage}
        />
      </div>

      {value.length > 0 ? (
        <div className="agent-flow-llm-prompt-messages__list">
          {value.map((message, index) => (
            <div
              key={message.id}
              className="agent-flow-llm-prompt-messages__row"
              data-testid={`llm-prompt-message-row-${message.id}`}
              onDragOver={(event) => event.preventDefault()}
              onDrop={() => handleDrop(index)}
            >
              <button
                aria-label={`拖拽排序 ${message.role.toUpperCase()} 消息`}
                className="agent-flow-llm-prompt-messages__drag-handle"
                draggable
                onDragEnd={() => setDraggingIndex(null)}
                onDragStart={() => setDraggingIndex(index)}
                type="button"
              >
                <HolderOutlined />
              </button>
              <div className="agent-flow-llm-prompt-messages__body">
                <div className="agent-flow-llm-prompt-messages__role-row">
                  <Select
                    aria-label={`${message.role.toUpperCase()} 消息角色`}
                    className="agent-flow-llm-prompt-messages__role-select"
                    options={LLM_PROMPT_MESSAGE_ROLES.map((role) => ({
                      label: role.toUpperCase(),
                      value: role
                    }))}
                    value={message.role}
                    onChange={(role) => updateRole(index, role)}
                  />
                  <Button
                    aria-label={`删除 ${message.role.toUpperCase()} 消息`}
                    danger
                    icon={<DeleteOutlined />}
                    size="small"
                    type="text"
                    onClick={() => removeMessage(index)}
                  />
                </div>
                <TemplatedTextField
                  ariaLabel={`${message.role.toUpperCase()} 消息内容`}
                  label={message.role.toUpperCase()}
                  options={options}
                  placeholder="输入文本，或输入 / 引用变量"
                  value={message.content.value}
                  onChange={(nextValue) => updateContent(index, nextValue)}
                />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无上下文消息" />
      )}
    </div>
  );
}
```

- [ ] **Step 7: Wire the field renderer**

Modify `web/app/src/features/agent-flow/schema/agent-flow-field-renderers.tsx` imports:

```ts
import { LlmPromptMessagesField } from '../components/detail/fields/LlmPromptMessagesField';
import {
  normalizePromptMessagesBinding,
  toPromptMessagesBinding
} from '../lib/llm-prompt-messages';
```

Add renderer:

```tsx
function renderLlmPromptMessagesField({
  adapter,
  block
}: SchemaFieldRendererProps) {
  const messages = normalizePromptMessagesBinding(
    adapter.getValue(block.path),
    adapter.getValue('bindings.system_prompt'),
    adapter.getValue('bindings.user_prompt')
  );

  return (
    <LlmPromptMessagesField
      options={getSelectorOptions(adapter)}
      value={messages}
      onChange={(nextValue) =>
        adapter.setValue(block.path, toPromptMessagesBinding(nextValue))
      }
    />
  );
}
```

Register it:

```ts
llm_prompt_messages: renderLlmPromptMessagesField,
```

- [ ] **Step 8: Add bounded CSS**

Append to `web/app/src/features/agent-flow/components/editor/styles/inspector.css`:

```css
.agent-flow-llm-prompt-messages {
  display: flex;
  width: 100%;
  flex-direction: column;
  gap: 10px;
}

.agent-flow-llm-prompt-messages__header,
.agent-flow-llm-prompt-messages__role-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.agent-flow-llm-prompt-messages__list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.agent-flow-llm-prompt-messages__row {
  display: grid;
  grid-template-columns: 24px minmax(0, 1fr);
  align-items: start;
  gap: 8px;
}

.agent-flow-llm-prompt-messages__drag-handle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 32px;
  padding: 0;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: #8ca095;
  cursor: grab;
}

.agent-flow-llm-prompt-messages__drag-handle:active {
  cursor: grabbing;
}

.agent-flow-llm-prompt-messages__drag-handle:hover,
.agent-flow-llm-prompt-messages__drag-handle:focus-visible {
  background: #f3f8f3;
  color: #55645d;
}

.agent-flow-llm-prompt-messages__body {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 8px;
}

.agent-flow-llm-prompt-messages__role-select {
  width: 132px;
}
```

- [ ] **Step 9: Run the UI test to verify it passes**

Run:

```bash
pnpm --dir web/app test:fast src/features/agent-flow/_tests/llm-prompt-messages/llm-prompt-messages-field.test.tsx
```

Expected: PASS.

- [ ] **Step 10: Run related frontend tests**

Run:

```bash
pnpm --dir web/app test:fast src/features/agent-flow/_tests/node-detail-panel.test.tsx src/features/agent-flow/_tests/templated-text-field.test.tsx src/features/agent-flow/_tests/templated-text-field-focus-layout.test.tsx
```

Expected: PASS.

- [ ] **Step 11: Commit**

```bash
git add web/app/src/features/agent-flow/lib/llm-prompt-messages.ts web/app/src/features/agent-flow/components/detail/fields/LlmPromptMessagesField.tsx web/app/src/features/agent-flow/_tests/llm-prompt-messages/llm-prompt-messages-field.test.tsx web/app/src/features/agent-flow/lib/node-definitions/types.ts web/app/src/features/agent-flow/lib/node-definitions/nodes/llm.ts web/app/src/features/agent-flow/schema/node-schema-fragments.ts web/app/src/features/agent-flow/schema/agent-flow-field-renderers.tsx web/app/src/features/agent-flow/components/editor/styles/inspector.css
git commit -m "feat: edit llm prompt messages in inspector"
```

---

### Task 3: Backend Runtime Prompt Message Execution

**Files:**
- Modify: `api/crates/orchestration-runtime/src/compiler.rs`
- Modify: `api/crates/orchestration-runtime/src/binding_runtime.rs`
- Modify: `api/crates/orchestration-runtime/src/execution_engine.rs`
- Test: `api/crates/orchestration-runtime/src/_tests/compiler_tests.rs`
- Test: `api/crates/orchestration-runtime/src/_tests/execution_engine_tests.rs`

- [ ] **Step 1: Write the failing compiler selector test**

Add to `api/crates/orchestration-runtime/src/_tests/compiler_tests.rs`:

```rust
#[test]
fn compile_extracts_selector_paths_from_llm_prompt_messages() {
    let mut document = valid_document();
    document["graph"]["nodes"][1]["bindings"] = json!({
        "prompt_messages": {
            "kind": "prompt_messages",
            "value": [
                {
                    "id": "system-1",
                    "role": "system",
                    "content": { "kind": "templated_text", "value": "Policy {{node-start.query}}" }
                },
                {
                    "id": "assistant-1",
                    "role": "assistant",
                    "content": { "kind": "templated_text", "value": "Prior {{node-start.files}}" }
                }
            ]
        }
    });

    let plan = FlowCompiler::compile(
        Uuid::nil(),
        "draft-1",
        &document,
        &ready_compile_context(),
    )
    .unwrap();

    assert_eq!(
        plan.nodes["node-llm"].bindings["prompt_messages"].selector_paths,
        vec![
            vec!["node-start".to_string(), "query".to_string()],
            vec!["node-start".to_string(), "files".to_string()]
        ]
    );
}
```

- [ ] **Step 2: Write failing execution tests**

Add to `api/crates/orchestration-runtime/src/_tests/execution_engine_tests.rs`:

```rust
#[tokio::test]
async fn llm_prompt_messages_are_sent_to_provider_in_order() {
    let captured_input = Arc::new(Mutex::new(None));
    let invoker = StubProviderInvoker {
        fail: false,
        captured_input: captured_input.clone(),
        final_content: "ok".to_string(),
    };
    let mut plan = base_plan();
    let llm = plan
        .nodes
        .get_mut("node-llm")
        .expect("llm node should exist");
    llm.bindings = BTreeMap::from([(
        "prompt_messages".to_string(),
        CompiledBinding {
            kind: "prompt_messages".to_string(),
            selector_paths: vec![vec!["node-start".to_string(), "query".to_string()]],
            raw_value: json!([
                {
                    "id": "system-1",
                    "role": "system",
                    "content": { "kind": "templated_text", "value": "Rules {{node-start.query}}" }
                },
                {
                    "id": "assistant-1",
                    "role": "assistant",
                    "content": { "kind": "templated_text", "value": "Earlier answer" }
                },
                {
                    "id": "user-1",
                    "role": "user",
                    "content": { "kind": "templated_text", "value": "Question {{node-start.query}}" }
                }
            ]),
        },
    )]);

    start_flow_debug_run(
        &plan,
        &json!({ "node-start": { "query": "hello" } }),
        &invoker,
    )
    .await
    .unwrap();

    let input = captured_input
        .lock()
        .expect("captured input mutex poisoned")
        .clone()
        .expect("provider input should be captured");

    assert_eq!(input.system, Some("Rules hello".to_string()));
    assert_eq!(input.messages.len(), 2);
    assert_eq!(input.messages[0].role, ProviderMessageRole::Assistant);
    assert_eq!(input.messages[0].content, "Earlier answer");
    assert_eq!(input.messages[1].role, ProviderMessageRole::User);
    assert_eq!(input.messages[1].content, "Question hello");
}

#[tokio::test]
async fn legacy_llm_prompt_bindings_still_send_single_user_message() {
    let captured_input = Arc::new(Mutex::new(None));
    let invoker = StubProviderInvoker {
        fail: false,
        captured_input: captured_input.clone(),
        final_content: "ok".to_string(),
    };
    let plan = base_plan();

    start_flow_debug_run(
        &plan,
        &json!({ "node-start": { "query": "hello" } }),
        &invoker,
    )
    .await
    .unwrap();

    let input = captured_input
        .lock()
        .expect("captured input mutex poisoned")
        .clone()
        .expect("provider input should be captured");

    assert_eq!(input.messages.len(), 1);
    assert_eq!(input.messages[0].role, ProviderMessageRole::User);
    assert_eq!(input.messages[0].content, "hello");
}
```

Ensure the test module imports `ProviderMessageRole`:

```rust
use plugin_framework::provider_contract::ProviderMessageRole;
```

- [ ] **Step 3: Run backend tests to verify they fail**

Run:

```bash
cargo test -p orchestration-runtime compile_extracts_selector_paths_from_llm_prompt_messages
cargo test -p orchestration-runtime llm_prompt_messages_are_sent_to_provider_in_order
```

Expected: first test fails with unsupported binding kind `prompt_messages`; second test fails because runtime does not resolve or render prompt messages.

- [ ] **Step 4: Compile selector paths from prompt messages**

Modify `api/crates/orchestration-runtime/src/compiler.rs` inside `extract_selector_paths`:

```rust
"prompt_messages" => {
    let messages = raw_value
        .as_array()
        .ok_or_else(|| anyhow!("prompt_messages value must be an array"))?;
    let mut selectors = Vec::new();

    for message in messages {
        let content = message
            .get("content")
            .and_then(|value| value.get("value"))
            .and_then(Value::as_str)
            .unwrap_or("");
        selectors.extend(parse_template_selector_tokens(content));
    }

    Ok(selectors)
}
```

- [ ] **Step 5: Resolve prompt message bindings**

Modify `api/crates/orchestration-runtime/src/binding_runtime.rs` inside `resolve_binding`:

```rust
"prompt_messages" => {
    let messages = binding
        .raw_value
        .as_array()
        .ok_or_else(|| anyhow!("prompt_messages raw_value must be an array"))?;
    let mut rendered_messages = Vec::with_capacity(messages.len());

    for message in messages {
        let role = message
            .get("role")
            .and_then(Value::as_str)
            .unwrap_or("user");
        let content = message
            .get("content")
            .and_then(|value| value.get("value"))
            .and_then(Value::as_str)
            .unwrap_or("");

        rendered_messages.push(serde_json::json!({
            "id": message.get("id").cloned().unwrap_or(Value::Null),
            "role": role,
            "content": render_template(content, variable_pool),
        }));
    }

    Ok(Value::Array(rendered_messages))
}
```

Also include `prompt_messages` in `render_templated_bindings`:

```rust
(binding.kind == "templated_text" || binding.kind == "prompt_messages")
```

- [ ] **Step 6: Build provider input from prompt messages**

Modify `api/crates/orchestration-runtime/src/execution_engine.rs` imports already include `ProviderMessageRole`.

Add helpers near `binding_text`:

```rust
fn prompt_messages(
    rendered_templates: &Map<String, Value>,
    resolved_inputs: &Map<String, Value>,
) -> Option<&Vec<Value>> {
    rendered_templates
        .get("prompt_messages")
        .or_else(|| resolved_inputs.get("prompt_messages"))
        .and_then(Value::as_array)
}

fn provider_role(value: &str) -> Option<ProviderMessageRole> {
    match value {
        "user" => Some(ProviderMessageRole::User),
        "assistant" => Some(ProviderMessageRole::Assistant),
        "system" => Some(ProviderMessageRole::System),
        _ => None,
    }
}
```

Replace message construction in `build_provider_invocation_input`:

```rust
let mut system_parts = Vec::new();
let mut messages = Vec::new();

if let Some(prompt_messages) = prompt_messages(rendered_templates, resolved_inputs) {
    for message in prompt_messages {
        let role = message
            .get("role")
            .and_then(Value::as_str)
            .and_then(provider_role)
            .unwrap_or(ProviderMessageRole::User);
        let content = message
            .get("content")
            .and_then(value_to_text)
            .unwrap_or_default();

        if content.is_empty() {
            continue;
        }

        if role == ProviderMessageRole::System {
            system_parts.push(content);
        } else {
            messages.push(ProviderMessage { role, content });
        }
    }
} else if let Some(content) = binding_text(rendered_templates, resolved_inputs, "user_prompt") {
    messages.push(ProviderMessage {
        role: ProviderMessageRole::User,
        content,
    });
}

let system = if system_parts.is_empty() {
    binding_text(rendered_templates, resolved_inputs, "system_prompt")
} else {
    Some(system_parts.join("\n\n"))
};
```

- [ ] **Step 7: Run backend tests to verify they pass**

Run:

```bash
cargo test -p orchestration-runtime compile_extracts_selector_paths_from_llm_prompt_messages
cargo test -p orchestration-runtime llm_prompt_messages_are_sent_to_provider_in_order
cargo test -p orchestration-runtime legacy_llm_prompt_bindings_still_send_single_user_message
```

Expected: PASS.

- [ ] **Step 8: Run all orchestration runtime tests**

Run:

```bash
cargo test -p orchestration-runtime
```

Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add api/crates/orchestration-runtime/src/compiler.rs api/crates/orchestration-runtime/src/binding_runtime.rs api/crates/orchestration-runtime/src/execution_engine.rs api/crates/orchestration-runtime/src/_tests/compiler_tests.rs api/crates/orchestration-runtime/src/_tests/execution_engine_tests.rs
git commit -m "feat: run llm prompt messages"
```

---

### Task 4: Integration Verification And QA

**Files:**
- Read: `.agents/skills/qa-evaluation/SKILL.md`
- Possible output: `tmp/test-governance/*`

- [ ] **Step 1: Run focused frontend checks**

Run:

```bash
pnpm --dir web/app test:fast src/features/agent-flow/_tests/agent-flow-document.test.ts src/features/agent-flow/_tests/document-transforms.test.ts src/features/agent-flow/_tests/llm-prompt-messages/llm-prompt-messages-field.test.tsx src/features/agent-flow/_tests/node-detail-panel.test.tsx
```

Expected: PASS.

- [ ] **Step 2: Run focused backend checks**

Run:

```bash
cargo test -p orchestration-runtime
```

Expected: PASS.

- [ ] **Step 3: Run standard frontend fast suite**

Run:

```bash
pnpm --dir web/app test:fast
```

Expected: PASS.

- [ ] **Step 4: Use qa-evaluation before delivery**

Read `.agents/skills/qa-evaluation/SKILL.md`, then produce a concise QA note with:

```md
## QA Evidence

- Frontend focused tests: command and PASS/FAIL result
- Backend orchestration runtime tests: command and PASS/FAIL result
- Frontend fast suite: command and PASS/FAIL result
- Residual risk: browser visual verification if dev server was not run
```

- [ ] **Step 5: Inspect git status**

Run:

```bash
git status --short
```

Expected: only intentional implementation changes remain, or the worktree is clean after commits.

---

## Self-Review

Spec coverage:

1. Ordered `SYSTEM / USER / ASSISTANT` messages: Task 2 and Task 3.
2. Initialization default `SYSTEM + USER(Start.query)`: Task 1.
3. Manual LLM default only empty `SYSTEM`: Task 1.
4. Legacy `system_prompt / user_prompt` compatibility: Task 2 and Task 3.
5. Real runtime context injection: Task 3.
6. Tests and QA evidence: all tasks, with final verification in Task 4.

Placeholder scan: no unresolved implementation markers are present.

Type consistency:

1. `prompt_messages` is the binding kind across schema, UI, compiler, binding runtime, and execution runtime.
2. Message roles are lowercase in persisted data and uppercase only in UI labels.
3. Message content is persisted as `{ kind: 'templated_text', value: string }` and rendered to provider message content at runtime.
