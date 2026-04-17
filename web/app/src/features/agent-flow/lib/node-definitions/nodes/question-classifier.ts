import { basicFields } from '../base';
import type { NodeDefinition } from '../types';

export const questionClassifierNodeDefinition: NodeDefinition = {
  label: 'Question Classifier',
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
          key: 'bindings.question',
          label: '待分类问题',
          editor: 'selector',
          required: true
        }
      ]
    },
    {
      key: 'outputs',
      title: 'Outputs',
      fields: [{ key: 'outputs.label', label: '分类标签', editor: 'text', required: true }]
    }
  ]
};
