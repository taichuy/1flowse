import { basicFields } from '../base';
import type { NodeDefinition } from '../types';

export const knowledgeRetrievalNodeDefinition: NodeDefinition = {
  label: 'Knowledge Retrieval',
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
        { key: 'bindings.query', label: '检索问题', editor: 'selector', required: true }
      ]
    },
    {
      key: 'outputs',
      title: 'Outputs',
      fields: [
        {
          key: 'outputs.documents',
          label: '知识结果',
          editor: 'text',
          required: true
        }
      ]
    },
    {
      key: 'policy',
      title: 'Policy',
      fields: [{ key: 'config.top_k', label: 'Top K', editor: 'number' }]
    }
  ]
};
