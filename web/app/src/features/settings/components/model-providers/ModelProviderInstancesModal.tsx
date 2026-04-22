import { useMemo, useState } from 'react';

import {
  Alert,
  Button,
  Empty,
  Modal,
  Select,
  Space,
  Table,
  Tag,
  Typography
} from 'antd';

import type {
  SettingsModelProviderCatalogEntry,
  SettingsModelProviderInstance,
  SettingsModelProviderModelCatalog
} from '../../api/model-providers';

function renderStatusTag(status: string) {
  switch (status) {
    case 'ready':
      return <Tag color="green">ready</Tag>;
    case 'invalid':
      return <Tag color="red">invalid</Tag>;
    case 'disabled':
      return <Tag>disabled</Tag>;
    default:
      return <Tag color="gold">{status}</Tag>;
  }
}

export function ModelProviderInstancesModal({
  open,
  catalogEntry,
  instances,
  modelCatalog,
  modelsLoading,
  refreshingCandidates,
  refreshing,
  deleting,
  canManage,
  versionSwitchNotice,
  onClose,
  onEdit,
  onFetchModels,
  onRefreshCandidates,
  onRefreshModels,
  onDelete
}: {
  open: boolean;
  catalogEntry: SettingsModelProviderCatalogEntry | null;
  instances: SettingsModelProviderInstance[];
  modelCatalog: SettingsModelProviderModelCatalog | null;
  modelsLoading: boolean;
  refreshingCandidates: boolean;
  refreshing: boolean;
  deleting: boolean;
  canManage: boolean;
  versionSwitchNotice: {
    targetVersion: string | null;
    migratedInstanceCount: number | null;
  } | null;
  onClose: () => void;
  onEdit: (instance: SettingsModelProviderInstance) => void;
  onFetchModels: (instance: SettingsModelProviderInstance) => void;
  onRefreshCandidates: (instance: SettingsModelProviderInstance) => void;
  onRefreshModels: (instance: SettingsModelProviderInstance) => void;
  onDelete: (instance: SettingsModelProviderInstance) => void;
}) {
  const [expandedRowKeys, setExpandedRowKeys] = useState<string[]>([]);
  const loadedModelsByInstanceId = useMemo(() => {
    if (!modelCatalog) {
      return {};
    }

    return {
      [modelCatalog.provider_instance_id]: modelCatalog.models
    } as Record<string, SettingsModelProviderModelCatalog['models']>;
  }, [modelCatalog]);

  function formatModelPreview(modelIds: string[]) {
    if (modelIds.length === 0) {
      return '未设置';
    }

    const preview = modelIds.slice(0, 3).join(' · ');
    return modelIds.length > 3 ? `${preview} · …` : preview;
  }

  return (
    <Modal
      open={open}
      width={920}
      title={catalogEntry ? `${catalogEntry.display_name} 实例` : '供应商实例'}
      onCancel={onClose}
      footer={null}
      destroyOnHidden
    >
      <div className="model-provider-panel__instances-modal">
        {versionSwitchNotice ? (
          <Alert
            type="warning"
            showIcon
            message="该供应商刚完成版本切换，建议刷新模型并验证关键实例。"
            description={
              versionSwitchNotice.targetVersion
                ? `当前目标版本 ${versionSwitchNotice.targetVersion}，已迁移 ${versionSwitchNotice.migratedInstanceCount ?? 0} 个实例。`
                : undefined
            }
          />
        ) : null}

        <div className="model-provider-panel__instances-modal-head">
          <div>
            <Typography.Text strong>查看供应商实例</Typography.Text>
            <Typography.Paragraph type="secondary">
              使用表格统一管理同一供应商下的全部实例，展开后可查看当前候选模型缓存。
            </Typography.Paragraph>
          </div>
        </div>

        <Table<SettingsModelProviderInstance>
          rowKey="id"
          pagination={false}
          dataSource={instances}
          locale={{
            emptyText: (
              <Empty
                className="model-provider-panel__empty"
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description="当前供应商还没有可用实例"
              />
            )
          }}
          expandable={{
            expandedRowKeys,
            onExpand: (expanded, record) => {
              setExpandedRowKeys(expanded ? [record.id] : []);
              if (expanded) {
                onFetchModels(record);
              }
            },
            expandedRowRender: (instance) => {
              const models = loadedModelsByInstanceId[instance.id] ?? [];
              const selectedModelId = instance.enabled_model_ids[0] ?? models[0]?.model_id;

              return (
                <div className="model-provider-panel__instances-modal-expanded">
                  <Space direction="vertical" size={8} style={{ width: '100%' }}>
                    <Typography.Text type="secondary">
                      候选缓存：{instance.model_count} 个 · 最近刷新：
                      {instance.catalog_refreshed_at ?? '未刷新'}
                    </Typography.Text>
                    <Typography.Text type="secondary">
                      生效模型：{formatModelPreview(instance.enabled_model_ids)}
                    </Typography.Text>
                    <Select
                      aria-label={`${instance.display_name} 候选模型`}
                      placeholder={
                        instance.model_count > 0
                          ? '展开后查看候选模型缓存'
                          : '当前还没有候选模型'
                      }
                      value={selectedModelId}
                      options={models.map((model) => ({
                        label: model.display_name,
                        value: model.model_id
                      }))}
                      notFoundContent={
                        modelsLoading && modelCatalog?.provider_instance_id === instance.id
                          ? '正在加载候选模型...'
                          : '暂无候选模型'
                      }
                    />
                  </Space>
                </div>
              );
            }
          }}
          columns={[
            {
              title: '操作',
              key: 'actions',
              width: 260,
              render: (_, instance) => (
                <Space size={4} wrap>
                  {canManage ? (
                    <Button
                      type="link"
                      aria-label={`编辑 API Key ${instance.display_name}`}
                      onClick={() => onEdit(instance)}
                    >
                      编辑 API Key
                    </Button>
                  ) : null}
                  {canManage ? (
                    <Button
                      type="link"
                      loading={refreshingCandidates}
                      aria-label={`刷新候选模型 ${instance.display_name}`}
                      onClick={() => onRefreshCandidates(instance)}
                    >
                      刷新候选模型
                    </Button>
                  ) : null}
                  {canManage ? (
                    <Button
                      type="link"
                      loading={refreshing}
                      aria-label={`刷新模型 ${instance.display_name}`}
                      onClick={() => onRefreshModels(instance)}
                    >
                      刷新模型
                    </Button>
                  ) : null}
                  {canManage ? (
                    <Button
                      danger
                      type="link"
                      loading={deleting}
                      aria-label={`删除实例 ${instance.display_name}`}
                      onClick={() => onDelete(instance)}
                    >
                      删除实例
                    </Button>
                  ) : null}
                </Space>
              )
            },
            {
              title: '实例名',
              key: 'instance',
              render: (_, instance) => (
                <div className="model-provider-panel__instance-cell">
                  <Typography.Text strong>{instance.display_name}</Typography.Text>
                  <Typography.Text type="secondary">
                    {instance.provider_code} · {instance.protocol}
                  </Typography.Text>
                </div>
              )
            },
            {
              title: '状态',
              dataIndex: 'status',
              width: 120,
              render: (status: string) => renderStatusTag(status)
            },
            {
              title: '生效模型',
              key: 'enabled_models',
              width: 180,
              render: (_, instance) => (
                <div className="model-provider-panel__instance-cell">
                  <Typography.Text>{instance.enabled_model_ids.length} 个</Typography.Text>
                  <Typography.Text type="secondary">
                    {formatModelPreview(instance.enabled_model_ids)}
                  </Typography.Text>
                </div>
              )
            },
            {
              title: '缓存模型',
              key: 'models',
              width: 150,
              render: (_, instance) => (
                <Button
                  type="link"
                  aria-label={`查看缓存模型 ${instance.display_name}`}
                  onClick={() => {
                    setExpandedRowKeys((current) =>
                      current.includes(instance.id) ? [] : [instance.id]
                    );
                    onFetchModels(instance);
                  }}
                >
                  {instance.model_count} 个
                </Button>
              )
            },
            {
              title: 'Base URL',
              key: 'base_url',
              render: (_, instance) => (
                <Typography.Text className="model-provider-panel__mono">
                  {String(instance.config_json.base_url ?? '未配置')}
                </Typography.Text>
              )
            }
          ]}
        />
      </div>
    </Modal>
  );
}
