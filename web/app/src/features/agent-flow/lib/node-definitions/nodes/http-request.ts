import { basicFields } from '../base';
import type { NodeDefinition } from '../types';

export const httpRequestNodeDefinition: NodeDefinition = {
  label: 'HTTP Request',
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
        { key: 'config.url', label: 'URL', editor: 'templated_text', required: true },
        { key: 'bindings.body', label: '请求体', editor: 'templated_text' }
      ]
    },
    {
      key: 'outputs',
      title: 'Outputs',
      fields: [{ key: 'outputs.body', label: '响应正文', editor: 'text', required: true }]
    },
    {
      key: 'policy',
      title: 'Policy',
      fields: [{ key: 'config.method', label: 'Method', editor: 'text' }]
    }
  ]
};
