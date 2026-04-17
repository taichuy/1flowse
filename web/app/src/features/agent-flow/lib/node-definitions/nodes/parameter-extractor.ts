import { basicFields } from '../base';
import type { NodeDefinition } from '../types';

export const parameterExtractorNodeDefinition: NodeDefinition = {
  label: 'Parameter Extractor',
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
          key: 'bindings.source_text',
          label: '源文本',
          editor: 'selector',
          required: true
        }
      ]
    },
    {
      key: 'outputs',
      title: 'Outputs',
      fields: [
        {
          key: 'outputs.parameters',
          label: '提取参数',
          editor: 'text',
          required: true
        }
      ]
    }
  ]
};
