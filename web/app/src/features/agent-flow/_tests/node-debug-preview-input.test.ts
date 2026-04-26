import { describe, expect, test } from 'vitest';

import { createDefaultAgentFlowDocument } from '@1flowbase/flow-schema';

import {
  buildNodeDebugPreviewPlan,
  extractNodePreviewVariableOutput
} from '../api/runtime';

describe('node debug preview input', () => {
  test('builds node preview input from cached referenced variables', () => {
    const document = createDefaultAgentFlowDocument({ flowId: 'flow-1' });

    expect(
      buildNodeDebugPreviewPlan(document, 'node-llm', {
        'node-start': {
          query: '请总结退款政策'
        }
      })
    ).toEqual({
      input_payload: {
        'node-start': {
          query: '请总结退款政策'
        }
      },
      missing_fields: []
    });
  });

  test('reports missing node preview variables instead of using placeholders', () => {
    const document = createDefaultAgentFlowDocument({ flowId: 'flow-1' });

    expect(buildNodeDebugPreviewPlan(document, 'node-llm')).toEqual({
      input_payload: {},
      missing_fields: [
        expect.objectContaining({
          nodeId: 'node-start',
          key: 'query',
          title: 'userinput.query',
          valueType: 'string'
        })
      ]
    });
  });

  test('extracts actual node output from node preview envelope for downstream previews', () => {
    const document = createDefaultAgentFlowDocument({ flowId: 'flow-1' });
    const llmOutput = extractNodePreviewVariableOutput({
      flow_run: {} as never,
      node_run: {
        output_payload: {
          target_node_id: 'node-llm',
          node_output: {
            text: '退款政策摘要',
            finish_reason: 'stop'
          },
          resolved_inputs: {
            user_prompt: '请总结退款政策'
          }
        }
      } as never,
      checkpoints: [],
      events: []
    });

    expect(llmOutput).toEqual({
      text: '退款政策摘要',
      finish_reason: 'stop'
    });
    expect(
      buildNodeDebugPreviewPlan(document, 'node-answer', {
        'node-llm': llmOutput
      })
    ).toEqual({
      input_payload: {
        'node-llm': {
          text: '退款政策摘要'
        }
      },
      missing_fields: []
    });
  });
});
