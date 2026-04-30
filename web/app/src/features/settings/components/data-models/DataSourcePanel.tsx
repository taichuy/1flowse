import { Descriptions, Form, Select, Space, Table, Tag, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';

import type { SettingsDataSourceInstance } from '../../api/data-models';

const dataModelStatusOptions = ['draft', 'published', 'disabled', 'broken'].map(
  (value) => ({ label: `默认 ${value}`, value })
);

const apiExposureOptions = [
  'draft',
  'published_not_exposed',
  'api_exposed_no_permission',
  'unsafe_external_source'
].map((value) => ({ label: `默认 ${value}`, value }));

export function DataSourcePanel({
  sources,
  selectedSourceId,
  loading,
  saving,
  onSelectSource,
  onUpdateDefaults
}: {
  sources: SettingsDataSourceInstance[];
  selectedSourceId: string | null;
  loading: boolean;
  saving: boolean;
  onSelectSource: (sourceId: string) => void;
  onUpdateDefaults: (
    source: SettingsDataSourceInstance,
    patch: Pick<
      SettingsDataSourceInstance,
      'default_data_model_status' | 'default_api_exposure_status'
    >
  ) => void;
}) {
  const selectedSource =
    sources.find((source) => source.id === selectedSourceId) ?? sources[0] ?? null;

  const columns: ColumnsType<SettingsDataSourceInstance> = [
    {
      title: '数据源',
      dataIndex: 'display_name',
      key: 'display_name',
      render: (_, source) => (
        <Space direction="vertical" size={2}>
          <Typography.Text strong>{source.display_name}</Typography.Text>
          <Typography.Text type="secondary">{source.source_code}</Typography.Text>
        </Space>
      )
    },
    {
      title: '类型',
      dataIndex: 'source_kind',
      key: 'source_kind',
      render: (value: string) => <Tag>{value}</Tag>
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (value: string) => <Tag color={value === 'ready' ? 'green' : 'default'}>{value}</Tag>
    }
  ];

  return (
    <div className="data-model-panel__sources">
      <Table
        rowKey="id"
        size="middle"
        loading={loading}
        columns={columns}
        dataSource={sources}
        pagination={false}
        rowSelection={{
          type: 'radio',
          selectedRowKeys: selectedSourceId ? [selectedSourceId] : [],
          onChange: ([sourceId]) => onSelectSource(String(sourceId))
        }}
        onRow={(source) => ({
          onClick: () => onSelectSource(source.id)
        })}
      />

      {selectedSource ? (
        <div className="data-model-panel__source-detail">
          <Descriptions
            size="small"
            column={{ xs: 1, sm: 2, lg: 3 }}
            items={[
              {
                key: 'id',
                label: 'ID',
                children: selectedSource.id
              },
              {
                key: 'source_kind',
                label: '来源类型',
                children: selectedSource.source_kind
              },
              {
                key: 'catalog',
                label: 'Catalog',
                children: selectedSource.catalog_refresh_status ?? '-'
              }
            ]}
          />
          <Form layout="inline" className="data-model-panel__defaults">
            <Form.Item
              label="默认 Data Model 状态"
              htmlFor="data-source-default-model-status"
            >
              <Select
                id="data-source-default-model-status"
                value={selectedSource.default_data_model_status}
                options={dataModelStatusOptions}
                disabled={selectedSource.source_kind === 'main_source' || saving}
                onChange={(value) =>
                  onUpdateDefaults(selectedSource, {
                    default_data_model_status: value,
                    default_api_exposure_status:
                      selectedSource.default_api_exposure_status
                  })
                }
              />
            </Form.Item>
            <Form.Item
              label="默认 API 暴露状态"
              htmlFor="data-source-default-api-status"
            >
              <Select
                id="data-source-default-api-status"
                value={selectedSource.default_api_exposure_status}
                options={apiExposureOptions}
                disabled={selectedSource.source_kind === 'main_source' || saving}
                onChange={(value) =>
                  onUpdateDefaults(selectedSource, {
                    default_data_model_status:
                      selectedSource.default_data_model_status,
                    default_api_exposure_status: value
                  })
                }
              />
            </Form.Item>
          </Form>
        </div>
      ) : null}
    </div>
  );
}
