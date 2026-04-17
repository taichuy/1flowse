import { basicFields } from '../base';
import type { NodeDefinition } from '../types';

export const humanInputNodeDefinition: NodeDefinition = {
  label: 'Human Input',
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
          key: 'config.prompt',
          label: '等待问题',
          editor: 'templated_text',
          required: true
        }
      ]
    },
    {
      key: 'outputs',
      title: 'Outputs',
      fields: [{ key: 'outputs.input', label: '人工输入', editor: 'text', required: true }]
    }
  ]
};
