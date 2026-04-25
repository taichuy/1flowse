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
      key: 'inputs',
      title: '输入字段',
      fields: [
        {
          key: 'config.input_fields',
          label: '输入字段',
          editor: 'start_input_fields'
        }
      ]
    }
  ]
};
