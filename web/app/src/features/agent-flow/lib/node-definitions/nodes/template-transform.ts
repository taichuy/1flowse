import { basicFields } from '../base';
import type { NodeDefinition } from '../types';

export const templateTransformNodeDefinition: NodeDefinition = {
  label: 'Template Transform',
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
          key: 'bindings.template',
          label: '模板',
          editor: 'templated_text',
          required: true
        }
      ]
    },
    {
      key: 'outputs',
      title: 'Outputs',
      fields: [{ key: 'outputs.text', label: '转换结果', editor: 'text', required: true }]
    }
  ]
};
