import { basicFields } from '../base';
import type { NodeDefinition } from '../types';

export const llmNodeDefinition: NodeDefinition = {
  label: 'LLM',
  sections: [
    {
      key: 'basics',
      title: 'Basics',
      fields: basicFields
    },
    {
      key: 'inputs',
      title: 'Inputs',
      fields: [
        {
          key: 'config.model_provider',
          label: '模型',
          editor: 'llm_model',
          required: true
        },
        {
          key: 'bindings.prompt_messages',
          label: '上下文',
          editor: 'llm_prompt_messages'
        }
      ]
    },
    {
      key: 'outputs',
      title: 'Outputs',
      fields: [{ key: 'outputs.text', label: '模型输出', editor: 'text', required: true }]
    },
    {
      key: 'advanced',
      title: 'Advanced',
      fields: [{ key: 'config.response_format', label: '返回格式', editor: 'llm_response_format' }]
    }
  ]
};
