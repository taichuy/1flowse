import { DeleteOutlined, PlusOutlined } from '@ant-design/icons';
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

const DYNAMIC_PROMPT_MESSAGE_ROLES = LLM_PROMPT_MESSAGE_ROLES.filter(
  (role) => role !== 'system'
);

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

function normalizeMessageGroups(messages: LlmPromptMessage[]) {
  const systemMessage =
    messages[0]?.role === 'system'
      ? messages[0]
      : createPromptMessage('system', 0);
  const dynamicMessages =
    messages[0]?.role === 'system'
      ? messages.slice(1)
      : messages.filter((message) => message.role !== 'system');

  return {
    systemMessage,
    dynamicMessages,
    orderedMessages: [systemMessage, ...dynamicMessages]
  };
}

export function LlmPromptMessagesField({
  value,
  options,
  onChange
}: LlmPromptMessagesFieldProps) {
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const { systemMessage, dynamicMessages, orderedMessages } =
    normalizeMessageGroups(value);

  function addMessage() {
    onChange([
      ...orderedMessages,
      createPromptMessage('user', orderedMessages.length)
    ]);
  }

  function updateRole(index: number, role: LlmPromptMessageRole) {
    if (index === 0 || role === 'system') {
      return;
    }

    onChange(updateAt(orderedMessages, index, { role }));
  }

  function updateContent(index: number, nextValue: string) {
    onChange(
      orderedMessages.map((message, messageIndex) =>
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
    if (index === 0) {
      return;
    }

    onChange(
      orderedMessages.filter((_, messageIndex) => messageIndex !== index)
    );
  }

  function handleDrop(targetIndex: number) {
    if (draggingIndex === null || draggingIndex === 0 || targetIndex === 0) {
      setDraggingIndex(null);
      return;
    }

    onChange(moveItem(orderedMessages, draggingIndex, targetIndex));
    setDraggingIndex(null);
  }

  function renderPromptMessage(message: LlmPromptMessage, index: number) {
    const isSystemMessage = index === 0 && message.role === 'system';
    const isDraggableMessage = !isSystemMessage;
    const rowClassName = [
      'agent-flow-llm-prompt-messages__row',
      isSystemMessage ? 'agent-flow-llm-prompt-messages__row--fixed' : null,
      isDraggableMessage
        ? 'agent-flow-llm-prompt-messages__row--draggable'
        : null
    ]
      .filter(Boolean)
      .join(' ');
    const roleLabel = message.role.toUpperCase();

    return (
      <div
        key={message.id}
        className={rowClassName}
        data-testid={`llm-prompt-message-row-${message.id}`}
        onDragOver={(event) => event.preventDefault()}
        onDrop={() => handleDrop(index)}
      >
        <div className="agent-flow-llm-prompt-messages__body">
          <TemplatedTextField
            ariaLabel={`${roleLabel} 消息内容`}
            draggable={isDraggableMessage}
            dragLabel={`拖拽排序 ${roleLabel} 消息`}
            label={roleLabel}
            labelContent={
              isSystemMessage ? (
                <Typography.Text
                  strong
                  className="agent-flow-templated-text-field__label"
                >
                  SYSTEM
                </Typography.Text>
              ) : (
                <select
                  aria-label={`${roleLabel} 消息角色`}
                  className="agent-flow-llm-prompt-messages__role-select"
                  value={message.role}
                  onChange={(event) =>
                    updateRole(
                      index,
                      event.target.value as LlmPromptMessageRole
                    )
                  }
                >
                  {DYNAMIC_PROMPT_MESSAGE_ROLES.map((role) => (
                    <option key={role} value={role}>
                      {role.toUpperCase()}
                    </option>
                  ))}
                </select>
              )
            }
            toolbarExtraActions={
              isSystemMessage ? null : (
                <Button
                  aria-label={`删除 ${roleLabel} 消息`}
                  className="agent-flow-templated-text-field__action"
                  danger
                  icon={<DeleteOutlined />}
                  size="small"
                  type="text"
                  onClick={() => removeMessage(index)}
                />
              )
            }
            options={options}
            placeholder="输入文本，或输入 / 引用变量"
            value={message.content.value}
            onChange={(nextValue) => updateContent(index, nextValue)}
            onDragEnd={() => setDraggingIndex(null)}
            onDragStart={() => setDraggingIndex(index)}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="agent-flow-llm-prompt-messages">
      <div className="agent-flow-llm-prompt-messages__header">
        <Typography.Text className="agent-flow-node-detail__section-subtitle">
          按顺序发送给模型的上下文消息
        </Typography.Text>
      </div>

      <div className="agent-flow-llm-prompt-messages__list">
        {renderPromptMessage(systemMessage, 0)}
        <div
          className="agent-flow-llm-prompt-messages__dynamic-list"
          data-testid="llm-prompt-message-dynamic-list"
        >
          {dynamicMessages.length > 0 ? (
            dynamicMessages.map((message, dynamicIndex) =>
              renderPromptMessage(message, dynamicIndex + 1)
            )
          ) : (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description="暂无消息"
            />
          )}
          <Button
            aria-label="新增消息"
            className="agent-flow-llm-prompt-messages__add-message"
            icon={<PlusOutlined />}
            size="small"
            type="dashed"
            onClick={addMessage}
          >
            新增消息
          </Button>
        </div>
      </div>
    </div>
  );
}
