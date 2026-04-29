import { Alert, Space } from 'antd';
import { useQuery } from '@tanstack/react-query';

import {
  fetchSettingsHostInfrastructureProviders,
  settingsHostInfrastructureProvidersQueryKey
} from '../../api/host-infrastructure';
import { SettingsSectionSurface } from '../SettingsSectionSurface';
import { HostInfrastructureProviderTable } from './HostInfrastructureProviderTable';
import './host-infrastructure-panel.css';

export function HostInfrastructurePanel({ canManage }: { canManage: boolean }) {
  const providersQuery = useQuery({
    queryKey: settingsHostInfrastructureProvidersQueryKey,
    queryFn: fetchSettingsHostInfrastructureProviders
  });

  return (
    <SettingsSectionSurface
      title="基础设施"
      description="管理缓存、短租约、事件、任务和限流等宿主基础设施 provider。"
    >
      <Space direction="vertical" size={16} className="host-infrastructure-panel">
        <Alert
          type="info"
          showIcon
          message="安装、配置和启用会保存为待应用变更，重启 api-server 一次后生效。"
        />
        <HostInfrastructureProviderTable
          providers={providersQuery.data ?? []}
          loading={providersQuery.isLoading}
          canManage={canManage}
        />
      </Space>
    </SettingsSectionSurface>
  );
}
