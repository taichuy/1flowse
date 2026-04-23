import { ApiDocsPanel } from '../../components/ApiDocsPanel';
import { MemberManagementPanel } from '../../components/MemberManagementPanel';
import { RolePermissionPanel } from '../../components/RolePermissionPanel';
import { SystemRuntimePanel } from '../../components/SystemRuntimePanel';
import type { SettingsSectionKey } from '../../lib/settings-sections';
import { SettingsFilesSection } from './SettingsFilesSection';
import { SettingsModelProvidersSection } from './SettingsModelProvidersSection';

export function SettingsSectionBody({
  sectionKey,
  isRoot,
  permissions,
  canManageMembers,
  canManageRoles,
  canManageModelProviders
}: {
  sectionKey: SettingsSectionKey;
  isRoot: boolean;
  permissions: string[];
  canManageMembers: boolean;
  canManageRoles: boolean;
  canManageModelProviders: boolean;
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
        <SettingsModelProvidersSection canManage={canManageModelProviders} />
      );
    case 'roles':
      return <RolePermissionPanel canManageRoles={canManageRoles} />;
    case 'docs':
    default:
      return <ApiDocsPanel />;
  }
}
