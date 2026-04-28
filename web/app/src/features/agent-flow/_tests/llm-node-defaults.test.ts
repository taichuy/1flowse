import { describe, expect, test } from 'vitest';

import { createNodeDocument } from '../lib/document/node-factory';

describe('LLM node defaults', () => {
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
});
