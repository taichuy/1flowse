import type { NodeDefinitionField } from './types';

export const basicFields: NodeDefinitionField[] = [
  { key: 'alias', label: '节点别名', editor: 'text', required: true },
  { key: 'description', label: '节点简介', editor: 'text' }
];
