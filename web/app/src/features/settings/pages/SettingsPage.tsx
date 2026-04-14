import { useMemo } from 'react';

import { Navigate } from '@tanstack/react-router';
import { Flex } from 'antd';

import { useAuthStore } from '../../../state/auth-store';
import { ApiDocsPanel } from '../components/ApiDocsPanel';
import { MemberManagementPanel } from '../components/MemberManagementPanel';
import { RolePermissionPanel } from '../components/RolePermissionPanel';
import { SettingsSidebar } from '../components/SettingsSidebar';
import {
  getVisibleSettingsSections,
  type SettingsSectionKey
} from '../lib/settings-sections';

export function SettingsPage({
  requestedSectionKey
}: {
  requestedSectionKey?: SettingsSectionKey;
}) {
  const actor = useAuthStore((state) => state.actor);
  const me = useAuthStore((state) => state.me);
  const permissionSet = useMemo(() => new Set(me?.permissions ?? []), [me?.permissions]);
  const isRoot = actor?.effective_display_role === 'root';
  const canManageMembers = isRoot || permissionSet.has('user.manage.all');
  const canManageRoles = isRoot || permissionSet.has('role_permission.manage.all');
  const visibleSections = getVisibleSettingsSections({
    isRoot,
    permissions: me?.permissions ?? []
  });
  const fallbackSection = visibleSections[0];
  const activeSection = visibleSections.find((section) => section.key === requestedSectionKey);

  if (!fallbackSection) {
    return null;
  }

  if (!requestedSectionKey || !activeSection) {
    return <Navigate to={fallbackSection.to} replace />;
  }

  return (
    <Flex align="flex-start" gap={24}>
      <SettingsSidebar
        sections={visibleSections.map((section) => ({
          key: section.key,
          label: section.label,
          visible: true
        }))}
        activeKey={activeSection.key}
        onSelect={() => {}}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        {activeSection?.key === 'members' ? (
          <MemberManagementPanel
            canManageMembers={canManageMembers}
            canManageRoleBindings={canManageRoles}
          />
        ) : activeSection?.key === 'roles' ? (
          <RolePermissionPanel canManageRoles={canManageRoles} />
        ) : (
          <ApiDocsPanel />
        )}
      </div>
    </Flex>
  );
}
