import { basicFields } from '../base';
import type { NodeDefinition } from '../types';

export const startNodeDefinition: NodeDefinition = {
  label: 'Start',
  sections: [
    {
      key: 'basics',
      title: 'Basics',
      fields: basicFields
    },
    {
      key: 'outputs',
      title: 'Outputs',
      fields: [{ key: 'outputs.query', label: '用户输入', editor: 'text', required: true }]
    }
  ]
};
