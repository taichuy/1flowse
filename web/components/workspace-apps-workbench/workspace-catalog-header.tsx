import { Button, Space, Tag, Typography } from "antd";

import type { WorkspaceSignal, WorkspaceQuickCreateEntry } from "@/components/workspace-apps-workbench/shared";

const { Title } = Typography;

export function WorkspaceCatalogHeader({
  workspaceName,
  currentRoleLabel,
  workspaceSignals,
  focusedCreateHref,
  workspaceUtilityEntry,
  onOpenCreate
}: {
  workspaceName: string;
  currentRoleLabel: string;
  workspaceSignals: WorkspaceSignal[];
  focusedCreateHref: string;
  workspaceUtilityEntry: WorkspaceQuickCreateEntry | null;
  onOpenCreate: () => void;
}) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
      <div>
        <Space align="center" size={12} wrap>
          <Title level={3} style={{ margin: 0 }}>应用</Title>
          <Tag color="blue" bordered={false}>{workspaceName}</Tag>
          <Tag color="gold" bordered={false}>{currentRoleLabel}</Tag>
        </Space>
      </div>

      <Space size={8} wrap>
        {workspaceUtilityEntry ? (
          <Button href={workspaceUtilityEntry.href}>{workspaceUtilityEntry.title}</Button>
        ) : null}
        <Button href={focusedCreateHref}>全屏创建页</Button>
        <Button onClick={onOpenCreate} type="primary">
          创建应用
        </Button>
      </Space>
    </div>
  );
}
