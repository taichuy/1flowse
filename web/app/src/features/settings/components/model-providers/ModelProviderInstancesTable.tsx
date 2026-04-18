import { Button, Empty, Space, Table, Tag, Typography } from 'antd';

import type {
  SettingsModelProviderCatalogEntry,
  SettingsModelProviderInstance
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

export function ModelProviderInstancesTable({
  instances,
  catalogEntries,
  loading,
  canManage,
  onCreate,
  onEdit,
  onValidate,
  onRefreshModels,
  onDelete
}: {
  instances: SettingsModelProviderInstance[];
  catalogEntries: SettingsModelProviderCatalogEntry[];
  loading?: boolean;
  canManage: boolean;
  onCreate: () => void;
  onEdit: (instance: SettingsModelProviderInstance) => void;
  onValidate: (instance: SettingsModelProviderInstance) => void;
  onRefreshModels: (instance: SettingsModelProviderInstance) => void;
  onDelete: (instance: SettingsModelProviderInstance) => void;
}) {
  return (
    <section className="model-provider-panel__instances">
      <div className="model-provider-panel__section-head">
        <div>
          <Typography.Title level={5}>实例列表</Typography.Title>
          <Typography.Text type="secondary">
            只展示当前 workspace 下的 provider instances。ready 实例会进入 agentFlow 模型选项。
          </Typography.Text>
        </div>
        {canManage ? (
          <Button
            type="primary"
            onClick={onCreate}
            disabled={catalogEntries.length === 0}
          >
            新建实例
          </Button>
        ) : null}
      </div>

      <Table<SettingsModelProviderInstance>
        rowKey="id"
        loading={loading}
        locale={{
          emptyText: (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={loading ? '正在加载实例...' : '暂无模型供应商实例'}
            />
          )
        }}
        pagination={false}
        dataSource={instances}
        columns={[
          {
            title: '实例',
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
            width: 110,
            render: (status: string) => renderStatusTag(status)
          },
          {
            title: 'Base URL',
            key: 'base_url',
            render: (_, instance) => (
              <Typography.Text className="model-provider-panel__mono">
                {String(instance.config_json.base_url ?? '未配置')}
              </Typography.Text>
            )
          },
          {
            title: '校验',
            key: 'validation',
            render: (_, instance) => (
              <div className="model-provider-panel__instance-cell">
                <Typography.Text>
                  {instance.last_validation_status ?? '未校验'}
                </Typography.Text>
                <Typography.Text type="secondary">
                  {instance.last_validation_message ?? '尚无校验结果'}
                </Typography.Text>
              </div>
            )
          },
          {
            title: '模型',
            key: 'models',
            width: 140,
            render: (_, instance) => (
              <div className="model-provider-panel__instance-cell">
                <Typography.Text>{instance.model_count} 个</Typography.Text>
                <Typography.Text type="secondary">
                  {instance.catalog_refresh_status ?? 'idle'}
                </Typography.Text>
              </div>
            )
          },
          ...(canManage
            ? [
                {
                  title: '操作',
                  key: 'actions',
                  width: 260,
                  render: (_: unknown, instance: SettingsModelProviderInstance) => (
                    <Space size={4} wrap>
                      <Button
                        type="link"
                        aria-label={`编辑 ${instance.display_name}`}
                        onClick={() => onEdit(instance)}
                      >
                        编辑
                      </Button>
                      <Button
                        type="link"
                        aria-label={`验证 ${instance.display_name}`}
                        onClick={() => onValidate(instance)}
                      >
                        验证
                      </Button>
                      <Button
                        type="link"
                        aria-label={`刷新模型 ${instance.display_name}`}
                        onClick={() => onRefreshModels(instance)}
                      >
                        刷新模型
                      </Button>
                      <Button
                        danger
                        type="link"
                        aria-label={`删除 ${instance.display_name}`}
                        onClick={() => onDelete(instance)}
                      >
                        删除
                      </Button>
                    </Space>
                  )
                }
              ]
            : [])
        ]}
      />
    </section>
  );
}
