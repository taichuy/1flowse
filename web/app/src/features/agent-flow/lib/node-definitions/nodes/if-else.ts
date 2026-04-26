import { basicFields } from '../base';
import type { NodeDefinition } from '../types';

export const ifElseNodeDefinition: NodeDefinition = {
  label: 'IfElse',
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
          key: 'bindings.condition_group',
          label: '条件组',
          editor: 'condition_group',
          required: true
        }
      ]
    },
    {
      key: 'outputs',
      title: 'Outputs',
      fields: []
    }
  ]
};
