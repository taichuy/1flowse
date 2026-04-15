import { Button, Space, Tag, Typography } from 'antd';

interface AgentFlowOverlayProps {
  applicationName: string;
  autosaveLabel: string;
  onOpenIssues: () => void;
  onOpenHistory: () => void;
  onOpenPublish: () => void;
  publishDisabled: boolean;
}

export function AgentFlowOverlay({
  applicationName,
  autosaveLabel,
  onOpenIssues,
  onOpenHistory,
  onOpenPublish,
  publishDisabled
}: AgentFlowOverlayProps) {
  return (
    <div className="agent-flow-editor__overlay">
      <div>
        <Typography.Title className="agent-flow-editor__title" level={4}>
          {applicationName}
        </Typography.Title>
        <Space size="small">
          <Tag color="green">{autosaveLabel}</Tag>
        </Space>
      </div>
      <Space size="small">
        <Button onClick={onOpenIssues}>Issues</Button>
        <Button onClick={onOpenHistory}>历史版本</Button>
        <Button disabled={publishDisabled} onClick={onOpenPublish}>
          发布配置
        </Button>
      </Space>
    </div>
  );
}
