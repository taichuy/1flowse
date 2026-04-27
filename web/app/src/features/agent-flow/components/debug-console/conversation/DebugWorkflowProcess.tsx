import { LoadingOutlined } from '@ant-design/icons';
import { Space, Tag, Typography } from 'antd';

import type { AgentFlowTraceItem } from '../../../api/runtime';

function statusColor(status: string) {
  switch (status) {
    case 'succeeded':
      return 'green';
    case 'failed':
      return 'red';
    case 'waiting_human':
      return 'gold';
    case 'waiting_callback':
      return 'cyan';
    default:
      return 'blue';
  }
}

function resolveCurrentTraceItem(items: AgentFlowTraceItem[]) {
  return (
    items.find((item) =>
      ['running', 'waiting_human', 'waiting_callback'].includes(item.status)
    ) ?? items.at(-1) ?? null
  );
}

export function DebugWorkflowProcess({
  items,
  onSelectNode
}: {
  items: AgentFlowTraceItem[];
  onSelectNode: (nodeId: string) => void;
}) {
  const currentItem = resolveCurrentTraceItem(items);

  if (!currentItem) {
    return null;
  }

  return (
    <button
      className="agent-flow-editor__debug-workflow-process"
      type="button"
      onClick={() => onSelectNode(currentItem.nodeId)}
    >
      <Space size={8} wrap>
        {currentItem.status === 'running' ? <LoadingOutlined spin /> : null}
        <Typography.Text type="secondary">当前节点</Typography.Text>
        <Typography.Text strong>{currentItem.nodeAlias}</Typography.Text>
        <Tag>{currentItem.nodeType}</Tag>
        <Tag color={statusColor(currentItem.status)}>{currentItem.status}</Tag>
      </Space>
      <Typography.Text type="secondary">
        {items.length} 个节点
      </Typography.Text>
    </button>
  );
}
