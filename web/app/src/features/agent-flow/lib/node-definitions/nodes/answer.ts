import { basicFields } from '../base';
import type { NodeDefinition } from '../types';

export const answerNodeDefinition: NodeDefinition = {
  label: 'Answer',
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
          key: 'bindings.answer_template',
          label: '回复内容',
          editor: 'selector',
          required: true
        }
      ]
    },
    {
      key: 'outputs',
      title: 'Outputs',
      fields: [{ key: 'outputs.answer', label: '对话输出', editor: 'text', required: true }]
    }
  ]
};
