import { Result } from 'antd';
import { Suspense, lazy, type ReactNode } from 'react';

import { MemberManagementPanel } from '../../components/MemberManagementPanel';
import { RolePermissionPanel } from '../../components/RolePermissionPanel';
import { SystemRuntimePanel } from '../../components/SystemRuntimePanel';
import type { SettingsSectionKey } from '../../lib/settings-sections';
import { SettingsDataModelsSection } from './SettingsDataModelsSection';
import { SettingsFilesSection } from './SettingsFilesSection';

const ApiDocsPanel = lazy(() =>
  import('../../components/ApiDocsPanel').then((module) => ({
    default: module.ApiDocsPanel
  }))
);
const SettingsModelProvidersSection = lazy(() =>
  import('./SettingsModelProvidersSection').then((module) => ({
    default: module.SettingsModelProvidersSection
  }))
);
const HostInfrastructurePanel = lazy(() =>
  import('../../components/host-infrastructure/HostInfrastructurePanel').then(
    (module) => ({
      default: module.HostInfrastructurePanel
    })
  )
);

function SettingsSectionFallback() {
  return <Result status="info" title="正在加载设置模块" />;
}

function SettingsSectionBoundary({ children }: { children: ReactNode }) {
  return <Suspense fallback={<SettingsSectionFallback />}>{children}</Suspense>;
}

export function SettingsSectionBody({
  sectionKey,
  isRoot,
  permissions,
  canManageMembers,
  canManageRoles,
  canManageDataModels,
  canManageModelProviders,
  canManageHostInfrastructure
}: {
  sectionKey: SettingsSectionKey;
  isRoot: boolean;
  permissions: string[];
  canManageMembers: boolean;
  canManageRoles: boolean;
  canManageDataModels: boolean;
  canManageModelProviders: boolean;
  canManageHostInfrastructure: boolean;
}) {
  switch (sectionKey) {
    case 'members':
      return (
        <MemberManagementPanel
          canManageMembers={canManageMembers}
          canManageRoleBindings={canManageRoles}
        />
      );
    case 'system-runtime':
      return <SystemRuntimePanel />;
    case 'files':
      return <SettingsFilesSection isRoot={isRoot} permissions={permissions} />;
    case 'model-providers':
      return (
        <SettingsSectionBoundary>
          <SettingsModelProvidersSection canManage={canManageModelProviders} />
        </SettingsSectionBoundary>
      );
    case 'data-models':
      return <SettingsDataModelsSection canManage={canManageDataModels} />;
    case 'host-infrastructure':
      return (
        <SettingsSectionBoundary>
          <HostInfrastructurePanel canManage={canManageHostInfrastructure} />
        </SettingsSectionBoundary>
      );
    case 'roles':
      return <RolePermissionPanel canManageRoles={canManageRoles} />;
    case 'docs':
    default:
      return (
        <SettingsSectionBoundary>
          <ApiDocsPanel />
        </SettingsSectionBoundary>
      );
  }
}
