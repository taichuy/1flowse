import { useState } from 'react';

import { Button, Flex, Space, Table, Tag, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';

import type {
  CreateSettingsDataModelInput,
  SettingsDataModel,
  SettingsDataSourceInstance,
  UpdateSettingsDataModelInput
} from '../../api/data-models';
import { DataModelFormDrawer } from './DataModelFormDrawer';

export function DataModelTable({
  models,
  selectedSource,
  selectedModelId,
  loading,
  saving,
  canManage,
  onSelectModel,
  onCreateModel,
  onUpdateModel
}: {
  models: SettingsDataModel[];
  selectedSource: SettingsDataSourceInstance | null;
  selectedModelId: string | null;
  loading: boolean;
  saving: boolean;
  canManage: boolean;
  onSelectModel: (model: SettingsDataModel) => void;
  onCreateModel: (input: CreateSettingsDataModelInput) => void;
  onUpdateModel: (
    model: SettingsDataModel,
    input: UpdateSettingsDataModelInput
  ) => void;
}) {
  const [drawerState, setDrawerState] = useState<
    | { open: false; mode: 'create'; model: null }
    | { open: true; mode: 'create'; model: null }
    | { open: true; mode: 'edit'; model: SettingsDataModel }
  >({ open: false, mode: 'create', model: null });

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
    },
    {
      title: '操作',
      key: 'actions',
      width: 120,
      render: (_, model) => (
        <Button
          type="link"
          size="small"
          disabled={!canManage}
          onClick={(event) => {
            event.stopPropagation();
            setDrawerState({ open: true, mode: 'edit', model });
          }}
        >
          编辑
        </Button>
      )
    }
  ];

  return (
    <Flex vertical gap={12}>
      <Flex justify="space-between" align="center" wrap="wrap" gap={8}>
        <Typography.Title level={4} className="data-model-panel__section-title">
          Data Models
        </Typography.Title>
        <Button
          type="primary"
          disabled={!canManage || !selectedSource}
          onClick={() =>
            setDrawerState({ open: true, mode: 'create', model: null })
          }
        >
          新建 Data Model
        </Button>
      </Flex>
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
      <DataModelFormDrawer
        open={drawerState.open}
        mode={drawerState.mode}
        model={drawerState.model}
        source={selectedSource}
        saving={saving}
        onClose={() =>
          setDrawerState({ open: false, mode: 'create', model: null })
        }
        onCreate={onCreateModel}
        onUpdate={onUpdateModel}
      />
    </Flex>
  );
}
