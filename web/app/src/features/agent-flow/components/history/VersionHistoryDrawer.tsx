import { Button, List } from 'antd';

import { SchemaDrawerPanel } from '../../../../shared/schema-ui/overlay-shell/SchemaDrawerPanel';

interface VersionHistoryDrawerProps {
  open: boolean;
  onClose: () => void;
  versions: Array<{
    id: string;
    sequence: number;
    trigger: 'autosave' | 'restore';
    change_kind: 'logical';
    summary: string;
    created_at: string;
  }>;
  restoring: boolean;
  onRestore: (versionId: string) => Promise<unknown>;
}

const historyDrawerSchema = {
  schemaVersion: '1.0.0',
  shellType: 'drawer_panel',
  title: '历史版本',
  width: 420,
  getContainer: false
} as const;

export function VersionHistoryDrawer({
  open,
  onClose,
  versions,
  restoring,
  onRestore
}: VersionHistoryDrawerProps) {
  return (
    <SchemaDrawerPanel open={open} schema={historyDrawerSchema} onClose={onClose}>
      <List
        dataSource={versions}
        locale={{ emptyText: '当前还没有可恢复的历史版本' }}
        renderItem={(version) => (
          <List.Item
            actions={[
              <Button
                key={version.id}
                loading={restoring}
                onClick={() => {
                  void onRestore(version.id);
                }}
              >
                恢复版本 {version.sequence}
              </Button>
            ]}
          >
            <List.Item.Meta
              title={`版本 ${version.sequence}`}
              description={`${version.summary} · ${version.created_at}`}
            />
          </List.Item>
        )}
      />
    </SchemaDrawerPanel>
  );
}
