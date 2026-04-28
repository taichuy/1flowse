import {
  DeleteOutlined,
  HolderOutlined,
  PlusOutlined
} from '@ant-design/icons';
import { Button, Empty, Typography } from 'antd';
import { useState } from 'react';

import type {
  LlmPromptMessage,
  LlmPromptMessageRole
} from '@1flowbase/flow-schema';

import { TemplatedTextField } from '../../bindings/TemplatedTextField';
import {
  createPromptMessage,
  LLM_PROMPT_MESSAGE_ROLES
} from '../../../lib/llm-prompt-messages';
import type { FlowSelectorOption } from '../../../lib/selector-options';

interface LlmPromptMessagesFieldProps {
  value: LlmPromptMessage[];
  options: FlowSelectorOption[];
  onChange: (value: LlmPromptMessage[]) => void;
}

function moveItem<T>(items: T[], from: number, to: number) {
  if (
    from === to ||
    from < 0 ||
    to < 0 ||
    from >= items.length ||
    to >= items.length
  ) {
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
                  <select
                    aria-label={`${message.role.toUpperCase()} 消息角色`}
                    className="agent-flow-llm-prompt-messages__role-select"
                    value={message.role}
                    onChange={(event) =>
                      updateRole(
                        index,
                        event.target.value as LlmPromptMessageRole
                      )
                    }
                  >
                    {LLM_PROMPT_MESSAGE_ROLES.map((role) => (
                      <option key={role} value={role}>
                        {role.toUpperCase()}
                      </option>
                    ))}
                  </select>
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
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="暂无上下文消息"
        />
      )}
    </div>
  );
}
