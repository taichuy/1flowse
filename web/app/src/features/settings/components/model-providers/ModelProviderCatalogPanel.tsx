import { Button, Empty, Space, Tag, Typography } from 'antd';

import type { SettingsModelProviderCatalogEntry } from '../../api/model-providers';

function getCatalogSummary(entry: SettingsModelProviderCatalogEntry) {
  if (entry.predefined_models.length > 0) {
    return `内置 ${entry.predefined_models.length} 个预置模型`;
  }

  if (entry.supports_model_fetch_without_credentials) {
    return '可在未配置密钥前拉取模型目录';
  }

  return '配置凭据后可校验连接并同步模型目录';
}

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
          <Typography.Title level={5}>已安装供应商</Typography.Title>
          <Typography.Text type="secondary">
            当前 workspace 已启用的供应商安装包。先选择供应商，再创建可用实例。
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
                <div className="model-provider-panel__catalog-item-main">
                  <div className="model-provider-panel__catalog-item-title-row">
                    <Typography.Title level={5}>{entry.display_name}</Typography.Title>
                    <Typography.Text type="secondary">
                      {entry.provider_code}
                    </Typography.Text>
                  </div>
                  <Typography.Text type="secondary">
                    {entry.protocol} · {getCatalogSummary(entry)}
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
                <span>默认地址 {entry.default_base_url ?? '未提供'}</span>
                <span>表单字段 {entry.form_schema.length}</span>
              </div>

              {entry.help_url ? (
                <Typography.Link href={entry.help_url} target="_blank">
                  查看文档
                </Typography.Link>
              ) : null}

              {canManage ? (
                <div className="model-provider-panel__catalog-item-actions">
                  <Button type="default" onClick={() => onCreate(entry)}>
                    添加 API 配置
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
