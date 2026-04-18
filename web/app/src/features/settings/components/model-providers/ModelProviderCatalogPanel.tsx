import { Button, Empty, Space, Tag, Typography } from 'antd';

import type { SettingsModelProviderCatalogEntry } from '../../api/model-providers';

export function ModelProviderCatalogPanel({
  entries,
  loading,
  canManage,
  onCreate
}: {
  entries: SettingsModelProviderCatalogEntry[];
  loading?: boolean;
  canManage: boolean;
  onCreate: (entry: SettingsModelProviderCatalogEntry) => void;
}) {
  return (
    <section className="model-provider-panel__catalog">
      <div className="model-provider-panel__section-head">
        <div>
          <Typography.Title level={5}>可用供应商</Typography.Title>
          <Typography.Text type="secondary">
            这里展示当前 workspace 已启用并已分配的 provider 安装包。
          </Typography.Text>
        </div>
      </div>

      {entries.length === 0 ? (
        <div className="model-provider-panel__empty">
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={loading ? '正在加载供应商目录...' : '暂无可用供应商'}
          />
        </div>
      ) : (
        <div className="model-provider-panel__catalog-list">
          {entries.map((entry) => (
            <article key={entry.installation_id} className="model-provider-panel__catalog-item">
              <div className="model-provider-panel__catalog-item-head">
                <div>
                  <Typography.Title level={5}>{entry.display_name}</Typography.Title>
                  <Typography.Text type="secondary">
                    {entry.provider_code} · {entry.protocol}
                  </Typography.Text>
                </div>
                <Space wrap size={6}>
                  <Tag color={entry.enabled ? 'green' : 'default'}>
                    {entry.enabled ? '已启用' : '未启用'}
                  </Tag>
                  <Tag>{entry.model_discovery_mode}</Tag>
                </Space>
              </div>

              <div className="model-provider-panel__catalog-item-meta">
                <span>版本 {entry.plugin_version}</span>
                <span>
                  默认入口 {entry.default_base_url ?? '未提供'}
                </span>
                <span>
                  预置模型 {entry.predefined_models.length}
                </span>
              </div>

              {entry.help_url ? (
                <Typography.Link href={entry.help_url} target="_blank">
                  查看文档
                </Typography.Link>
              ) : null}

              {canManage ? (
                <div className="model-provider-panel__catalog-item-actions">
                  <Button type="default" onClick={() => onCreate(entry)}>
                    基于此创建实例
                  </Button>
                </div>
              ) : null}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
