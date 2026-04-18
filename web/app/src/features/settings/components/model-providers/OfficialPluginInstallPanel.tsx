import { useMemo, useState } from 'react';

import { Button, Empty, Modal, Select, Space, Tag, Typography } from 'antd';

import type { SettingsOfficialPluginCatalogEntry } from '../../api/plugins';

type InstallState = 'idle' | 'installing' | 'success' | 'failed';

function getInstallButtonLabel(
  entry: SettingsOfficialPluginCatalogEntry,
  installState: InstallState,
  activePluginId: string | null
) {
  if (activePluginId === entry.plugin_id && installState === 'installing') {
    return '安装中';
  }

  if (
    entry.install_status === 'assigned' ||
    (activePluginId === entry.plugin_id && installState === 'success')
  ) {
    return '已安装到当前 workspace';
  }

  if (activePluginId === entry.plugin_id && installState === 'failed') {
    return '重试安装';
  }

  return '安装到当前 workspace';
}

function getStatusTag(
  entry: SettingsOfficialPluginCatalogEntry,
  installState: InstallState,
  activePluginId: string | null
) {
  if (activePluginId === entry.plugin_id && installState === 'installing') {
    return <Tag color="processing">安装中</Tag>;
  }

  if (
    entry.install_status === 'assigned' ||
    (activePluginId === entry.plugin_id && installState === 'success')
  ) {
    return <Tag color="green">当前 workspace 已可用</Tag>;
  }

  if (entry.install_status === 'installed') {
    return <Tag color="gold">已安装，待分配</Tag>;
  }

  if (activePluginId === entry.plugin_id && installState === 'failed') {
    return <Tag color="red">安装失败</Tag>;
  }

  return <Tag>未安装</Tag>;
}

export function OfficialPluginInstallPanel({
  entries,
  loading,
  canManage,
  activePluginId,
  installState,
  onInstall
}: {
  entries: SettingsOfficialPluginCatalogEntry[];
  loading?: boolean;
  canManage: boolean;
  activePluginId: string | null;
  installState: InstallState;
  onInstall: (entry: SettingsOfficialPluginCatalogEntry) => void;
}) {
  const [modal, contextHolder] = Modal.useModal();
  const [selectedPluginId, setSelectedPluginId] = useState<string | null>(null);
  const visibleEntries = useMemo(() => {
    if (!selectedPluginId) {
      return entries;
    }

    return entries.filter((entry) => entry.plugin_id === selectedPluginId);
  }, [entries, selectedPluginId]);

  return (
    <section className="model-provider-panel__official">
      {contextHolder}
      <div className="model-provider-panel__section-head">
        <div>
          <Typography.Title level={5}>安装模型供应商</Typography.Title>
          <Typography.Text type="secondary">
            从官方目录补充新的供应商，安装完成后会自动分配到当前 workspace。
          </Typography.Text>
        </div>
      </div>
      <Select
        allowClear
        showSearch
        className="model-provider-panel__official-select"
        placeholder="下拉搜索可安装供应商"
        optionFilterProp="label"
        value={selectedPluginId}
        onChange={(value) => setSelectedPluginId(value ?? null)}
        options={entries.map((entry) => ({
          value: entry.plugin_id,
          label: `${entry.display_name} / ${entry.protocol}`
        }))}
      />

      {entries.length === 0 ? (
        <div className="model-provider-panel__empty">
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={loading ? '正在加载官方供应商目录...' : '暂无可安装的官方供应商'}
          />
        </div>
      ) : (
        <div className="model-provider-panel__official-grid">
          {visibleEntries.map((entry) => {
            const buttonLabel = getInstallButtonLabel(entry, installState, activePluginId);
            const installing =
              activePluginId === entry.plugin_id && installState === 'installing';
            const installed =
              entry.install_status === 'assigned' ||
              (activePluginId === entry.plugin_id && installState === 'success');

            return (
              <article
                key={entry.plugin_id}
                className="model-provider-panel__official-card"
              >
                <div className="model-provider-panel__catalog-item-head">
                  <div className="model-provider-panel__catalog-item-main">
                    <div className="model-provider-panel__catalog-item-title-row">
                      <Typography.Title level={5}>{entry.display_name}</Typography.Title>
                    </div>
                    <Typography.Text type="secondary">
                      {entry.protocol} · latest {entry.latest_version}
                    </Typography.Text>
                  </div>
                  <Space wrap size={6}>
                    {getStatusTag(entry, installState, activePluginId)}
                    <Tag>{entry.model_discovery_mode}</Tag>
                  </Space>
                </div>

                <div className="model-provider-panel__catalog-item-meta">
                  <span>{entry.plugin_id}</span>
                  <span>版本 {entry.latest_version}</span>
                </div>

                {entry.help_url ? (
                  <Typography.Link href={entry.help_url} target="_blank">
                    查看插件说明
                  </Typography.Link>
                ) : null}

                {canManage ? (
                  <div className="model-provider-panel__catalog-item-actions">
                    <Button
                      type={installed ? 'default' : 'primary'}
                      loading={installing}
                      disabled={installed}
                      onClick={() => {
                        void modal.confirm({
                          title: '安装插件',
                          icon: null,
                          centered: true,
                          okText: buttonLabel,
                          cancelText: '取消',
                          okButtonProps: {
                            loading: installing,
                            disabled: installed
                          },
                          content: (
                            <div className="model-provider-panel__install-confirm">
                              <div className="model-provider-panel__install-confirm-card">
                                <Typography.Title level={5}>
                                  {entry.display_name}
                                </Typography.Title>
                                <Typography.Paragraph type="secondary">
                                  即将安装官方插件 `latest {entry.latest_version}`，完成后会自动启用到当前 workspace。
                                </Typography.Paragraph>
                                <div className="model-provider-panel__catalog-item-meta">
                                  <span>协议 {entry.protocol}</span>
                                  <span>发现模式 {entry.model_discovery_mode}</span>
                                </div>
                              </div>
                            </div>
                          ),
                          onOk: async () => {
                            onInstall(entry);
                          }
                        });
                      }}
                    >
                      {buttonLabel}
                    </Button>
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
