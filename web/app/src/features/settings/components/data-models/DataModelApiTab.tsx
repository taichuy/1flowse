import { Descriptions, Tag } from 'antd';

import type { SettingsDataModel } from '../../api/data-models';

export function DataModelApiTab({ model }: { model: SettingsDataModel }) {
  const ready =
    model.status === 'published' &&
    model.runtime_availability === 'available' &&
    model.api_exposure_status === 'api_exposed_ready';

  return (
    <Descriptions
      size="small"
      column={1}
      items={[
        {
          key: 'status',
          label: 'API 暴露状态',
          children: <Tag>{model.api_exposure_status}</Tag>
        },
        {
          key: 'readiness',
          label: 'computed readiness',
          children: <Tag color={ready ? 'green' : 'default'}>api_exposed_ready</Tag>
        },
        {
          key: 'runtime',
          label: 'Runtime',
          children: model.runtime_availability
        },
        {
          key: 'namespace',
          label: 'ACL Namespace',
          children: model.acl_namespace
        }
      ]}
    />
  );
}
