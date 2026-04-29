import { Result } from 'antd';
import { Suspense, lazy, type ReactNode } from 'react';

import { MemberManagementPanel } from '../../components/MemberManagementPanel';
import { RolePermissionPanel } from '../../components/RolePermissionPanel';
import { SystemRuntimePanel } from '../../components/SystemRuntimePanel';
import type { SettingsSectionKey } from '../../lib/settings-sections';

const ApiDocsPanel = lazy(() =>
  import('../../components/ApiDocsPanel').then((module) => ({
    default: module.ApiDocsPanel
  }))
);
const SettingsFilesSection = lazy(() =>
  import('./SettingsFilesSection').then((module) => ({
    default: module.SettingsFilesSection
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
  canManageModelProviders,
  canManageHostInfrastructure
}: {
  sectionKey: SettingsSectionKey;
  isRoot: boolean;
  permissions: string[];
  canManageMembers: boolean;
  canManageRoles: boolean;
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
      return (
        <SettingsSectionBoundary>
          <SettingsFilesSection isRoot={isRoot} permissions={permissions} />
        </SettingsSectionBoundary>
      );
    case 'model-providers':
      return (
        <SettingsSectionBoundary>
          <SettingsModelProvidersSection canManage={canManageModelProviders} />
        </SettingsSectionBoundary>
      );
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
