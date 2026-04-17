import { basicFields } from '../base';
import type { NodeDefinition } from '../types';

export const loopNodeDefinition: NodeDefinition = {
  label: 'Loop',
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
          key: 'bindings.entry_condition',
          label: '入口条件',
          editor: 'condition_group',
          required: true
        }
      ]
    },
    {
      key: 'policy',
      title: 'Policy',
      fields: [{ key: 'config.max_rounds', label: '最大轮数', editor: 'number' }]
    },
    {
      key: 'outputs',
      title: 'Outputs',
      fields: [{ key: 'outputs.result', label: '聚合输出', editor: 'text', required: true }]
    }
  ]
};
