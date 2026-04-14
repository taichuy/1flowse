import { useEffect, useMemo, useState } from 'react';

import { Flex } from 'antd';

import { useAuthStore } from '../../../state/auth-store';
import { ApiDocsPanel } from '../components/ApiDocsPanel';
import { MemberManagementPanel } from '../components/MemberManagementPanel';
import { RolePermissionPanel } from '../components/RolePermissionPanel';
import {
  SettingsSidebar,
  type SettingsSection
} from '../components/SettingsSidebar';

export function SettingsPage() {
  const actor = useAuthStore((state) => state.actor);
  const me = useAuthStore((state) => state.me);
  const permissionSet = useMemo(() => new Set(me?.permissions ?? []), [me?.permissions]);
  const isRoot = actor?.effective_display_role === 'root';
  const canViewMembers = isRoot || permissionSet.has('user.view.all');
  const canManageMembers = isRoot || permissionSet.has('user.manage.all');
  const canViewRoles = isRoot || permissionSet.has('role_permission.view.all');
  const canManageRoles = isRoot || permissionSet.has('role_permission.manage.all');

  const sections: SettingsSection[] = [
    { key: 'docs', label: 'API 文档', visible: true },
    { key: 'members', label: '用户管理', visible: canViewMembers },
    { key: 'roles', label: '权限管理', visible: canViewRoles }
  ];
  const visibleSections = sections.filter((section) => section.visible);
  const [activeSectionKey, setActiveSectionKey] = useState(visibleSections[0]?.key ?? 'docs');

  useEffect(() => {
    if (!visibleSections.some((section) => section.key === activeSectionKey)) {
      setActiveSectionKey(visibleSections[0]?.key ?? 'docs');
    }
  }, [activeSectionKey, visibleSections]);

  const activeSection = visibleSections.find((section) => section.key === activeSectionKey);

  return (
    <Flex align="flex-start" gap={24}>
      <SettingsSidebar
        sections={sections}
        activeKey={activeSectionKey}
        onSelect={setActiveSectionKey}
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
