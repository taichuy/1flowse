import type { FlowNodeDocument } from '@1flowbase/flow-schema';

import { basicFields } from '../../base';
import type { NodeDefinition } from '../../types';

export type DataModelNodeAction = 'list' | 'get' | 'create' | 'update' | 'delete';

export const DATA_MODEL_ACTION_OPTIONS = [
  { value: 'list', label: 'List' },
  { value: 'get', label: 'Get' },
  { value: 'create', label: 'Create' },
  { value: 'update', label: 'Update' },
  { value: 'delete', label: 'Delete' }
];

const RECORD_ID_ACTIONS = ['get', 'update', 'delete'] as const;
const PAYLOAD_ACTIONS = ['create', 'update'] as const;

export const defaultDataModelNodeConfig = {
  data_model_code: '',
  action: 'list'
} as const;

const dataModelActionOutputs = {
  list: [
    { key: 'records', title: '记录列表', valueType: 'array' },
    { key: 'total', title: '记录总数', valueType: 'number' }
  ],
  get: [{ key: 'record', title: '记录', valueType: 'json' }],
  create: [{ key: 'record', title: '记录', valueType: 'json' }],
  update: [{ key: 'record', title: '记录', valueType: 'json' }],
  delete: [{ key: 'deleted_id', title: '删除记录 ID', valueType: 'string' }]
} satisfies Record<DataModelNodeAction, FlowNodeDocument['outputs']>;

export function resolveDataModelNodeAction(value: unknown): DataModelNodeAction {
  return DATA_MODEL_ACTION_OPTIONS.some((option) => option.value === value)
    ? (value as DataModelNodeAction)
    : 'list';
}

export function getDataModelNodeOutputs(
  action: unknown
): FlowNodeDocument['outputs'] {
  return dataModelActionOutputs[resolveDataModelNodeAction(action)];
}

export const dataModelNodeDefinition: NodeDefinition = {
  label: 'Data Model',
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
          key: 'config.data_model_code',
          label: 'Data Model',
          editor: 'data_model',
          required: true
        },
        {
          key: 'config.action',
          label: 'Action',
          editor: 'static_select',
          required: true,
          options: DATA_MODEL_ACTION_OPTIONS
        },
        {
          key: 'bindings.record_id',
          label: 'record_id',
          editor: 'templated_text',
          required: true,
          visibleWhen: {
            operator: 'in',
            path: 'config.action',
            values: RECORD_ID_ACTIONS
          }
        },
        {
          key: 'bindings.payload',
          label: 'payload',
          editor: 'named_bindings',
          required: true,
          visibleWhen: {
            operator: 'in',
            path: 'config.action',
            values: PAYLOAD_ACTIONS
          }
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
