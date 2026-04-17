import { basicFields } from '../base';
import type { NodeDefinition } from '../types';

export const toolNodeDefinition: NodeDefinition = {
  label: 'Tool',
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
        { key: 'config.tool_name', label: '工具名称', editor: 'text', required: true },
        { key: 'bindings.parameters', label: '工具入参', editor: 'named_bindings' }
      ]
    },
    {
      key: 'outputs',
      title: 'Outputs',
      fields: [{ key: 'outputs.result', label: '工具输出', editor: 'text', required: true }]
    }
  ]
};
