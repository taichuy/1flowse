import { Space, Table, Tag, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';

import type { SettingsDataModel } from '../../api/data-models';

export function DataModelTable({
  models,
  selectedModelId,
  loading,
  onSelectModel
}: {
  models: SettingsDataModel[];
  selectedModelId: string | null;
  loading: boolean;
  onSelectModel: (model: SettingsDataModel) => void;
}) {
  const columns: ColumnsType<SettingsDataModel> = [
    {
      title: 'Data Model',
      dataIndex: 'title',
      key: 'title',
      render: (_, model) => (
        <Space direction="vertical" size={2}>
          <Typography.Text strong>{model.title}</Typography.Text>
          <Typography.Text type="secondary">{model.code}</Typography.Text>
        </Space>
      )
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (value: string) => <Tag>状态 {value}</Tag>
    },
    {
      title: 'API',
      dataIndex: 'api_exposure_status',
      key: 'api_exposure_status',
      render: (value: string) => <Tag>API {value}</Tag>
    },
    {
      title: '字段',
      key: 'fields',
      render: (_, model) => model.fields.length
    }
  ];

  return (
    <Table
      rowKey="id"
      size="middle"
      loading={loading}
      columns={columns}
      dataSource={models}
      pagination={false}
      rowSelection={{
        type: 'radio',
        selectedRowKeys: selectedModelId ? [selectedModelId] : [],
        onChange: ([modelId]) => {
          const model = models.find((item) => item.id === modelId);
          if (model) {
            onSelectModel(model);
          }
        }
      }}
      onRow={(model) => ({
        onClick: () => onSelectModel(model)
      })}
    />
  );
}
