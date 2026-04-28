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

export function toPromptMessagesBinding(
  messages: LlmPromptMessage[]
): FlowBinding {
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
