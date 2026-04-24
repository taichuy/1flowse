import { FileManagementPanel } from '../../components/FileManagementPanel';

function hasAnyPermission(permissions: string[], candidates: string[]) {
  return candidates.some((permission) => permissions.includes(permission));
}

export function SettingsFilesSection({
  isRoot,
  permissions
}: {
  isRoot: boolean;
  permissions: string[];
}) {
  const canViewTables =
    isRoot ||
    hasAnyPermission(permissions, ['file_table.view.all', 'file_table.view.own']);
  const canCreateTables = isRoot || permissions.includes('file_table.create.all');

  return (
    <FileManagementPanel
      isRoot={isRoot}
      canViewTables={canViewTables}
      canCreateTables={canCreateTables}
    />
  );
}
