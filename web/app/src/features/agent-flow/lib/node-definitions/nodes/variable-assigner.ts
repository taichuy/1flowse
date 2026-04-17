import { basicFields } from '../base';
import type { NodeDefinition } from '../types';

export const variableAssignerNodeDefinition: NodeDefinition = {
  label: 'Variable Assigner',
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
          key: 'bindings.operations',
          label: '变量操作',
          editor: 'state_write',
          required: true
        }
      ]
    },
    {
      key: 'outputs',
      title: 'Outputs',
      fields: [{ key: 'outputs.state', label: '状态结果', editor: 'text', required: true }]
    }
  ]
};
