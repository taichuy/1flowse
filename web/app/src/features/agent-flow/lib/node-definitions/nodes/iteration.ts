import { basicFields } from '../base';
import type { NodeDefinition } from '../types';

export const iterationNodeDefinition: NodeDefinition = {
  label: 'Iteration',
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
        { key: 'bindings.items', label: '循环列表', editor: 'selector', required: true }
      ]
    },
    {
      key: 'outputs',
      title: 'Outputs',
      fields: [{ key: 'outputs.result', label: '聚合输出', editor: 'text', required: true }]
    }
  ]
};
