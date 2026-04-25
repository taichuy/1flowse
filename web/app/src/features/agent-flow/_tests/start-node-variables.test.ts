import { describe, expect, test } from 'vitest';

import { createDefaultAgentFlowDocument } from '@1flowbase/flow-schema';

import { buildFlowDebugRunInput } from '../api/runtime';
import { listVisibleSelectorOptions } from '../lib/selector-options';

describe('start node variables', () => {
  test('exposes custom input fields and readonly system variables to downstream selectors', () => {
    const document = createDefaultAgentFlowDocument({ flowId: 'flow-1' });
    const startNode = document.graph.nodes.find(
      (node) => node.id === 'node-start'
    );

    if (!startNode) {
      throw new Error('expected start node');
    }

    startNode.config.input_fields = [
      {
        key: 'customer_name',
        label: '客户姓名',
        inputType: 'text',
        valueType: 'string',
        required: true
      },
      {
        key: 'attachments',
        label: '附件',
        inputType: 'file_list',
        valueType: 'array',
        required: false
      }
    ];

    expect(
      listVisibleSelectorOptions(document, 'node-llm').map((option) => ({
        value: option.value,
        label: option.displayLabel
      }))
    ).toEqual(
      expect.arrayContaining([
        { value: ['node-start', 'customer_name'], label: 'Start / 客户姓名' },
        { value: ['node-start', 'attachments'], label: 'Start / 附件' },
        { value: ['node-start', 'query'], label: 'Start / userinput.query' },
        { value: ['node-start', 'files'], label: 'Start / userinput.files' }
      ])
    );
  });

  test('builds flow debug input from start input field value types', () => {
    const document = createDefaultAgentFlowDocument({ flowId: 'flow-1' });
    const startNode = document.graph.nodes.find(
      (node) => node.id === 'node-start'
    );

    if (!startNode) {
      throw new Error('expected start node');
    }

    startNode.config.input_fields = [
      {
        key: 'customer_name',
        label: '客户姓名',
        inputType: 'text',
        valueType: 'string',
        required: true
      },
      {
        key: 'age',
        label: '年龄',
        inputType: 'number',
        valueType: 'number',
        required: false
      },
      {
        key: 'files',
        label: '附件',
        inputType: 'file_list',
        valueType: 'array',
        required: false
      }
    ];

    expect(buildFlowDebugRunInput(document)).toEqual({
      input_payload: {
        'node-start': {
          customer_name: 'Start customer_name 调试值',
          age: 1,
          files: [],
          query: '总结退款政策'
        }
      }
    });
  });
});
