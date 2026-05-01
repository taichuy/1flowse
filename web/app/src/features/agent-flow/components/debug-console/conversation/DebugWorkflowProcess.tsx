import {
  CheckCircleFilled,
  DownOutlined,
  LoadingOutlined,
  RightOutlined
} from '@ant-design/icons';
import { Typography } from 'antd';

import type { AgentFlowTraceItem } from '../../../api/runtime';

function statusTone(status: string) {
  switch (status) {
    case 'succeeded':
      return 'success';
    case 'failed':
      return 'error';
    case 'waiting_human':
    case 'waiting_callback':
      return 'warning';
    default:
      return 'running';
  }
}

function nodeDisplayName(item: AgentFlowTraceItem) {
  if (item.nodeType === 'start') {
    return '用户输入';
  }

  if (item.nodeType === 'answer') {
    return '直接回复';
  }

  return item.nodeAlias;
}

function nodeIconTone(item: AgentFlowTraceItem) {
  if (item.nodeType === 'start') {
    return 'start';
  }

  if (item.nodeType === 'answer') {
    return 'answer';
  }

  return 'default';
}

function metricText(item: AgentFlowTraceItem) {
  const tokens = item.metricsPayload.total_tokens;
  const duration = item.durationMs == null ? null : `${item.durationMs} ms`;

  if (typeof tokens === 'number' && duration) {
    return `${tokens} tokens · ${duration}`;
  }

  if (typeof tokens === 'number') {
    return `${tokens} tokens`;
  }

  if (duration) {
    return duration;
  }

  return '进行中';
}

function StatusIcon({ status }: { status: string }) {
  const tone = statusTone(status);

  if (tone === 'running') {
    return <LoadingOutlined className="agent-flow-editor__debug-workflow-status-icon" spin />;
  }

  return (
    <CheckCircleFilled
      className={`agent-flow-editor__debug-workflow-status-icon agent-flow-editor__debug-workflow-status-icon--${tone}`}
    />
  );
}

export function DebugWorkflowProcess({
  items,
  onSelectNode
}: {
  items: AgentFlowTraceItem[];
  onSelectNode: (nodeId: string) => void;
}) {
  if (items.length === 0) {
    return null;
  }

  return (
    <div
      aria-label="工作流"
      className="agent-flow-editor__debug-workflow-process"
      role="group"
    >
      <div className="agent-flow-editor__debug-workflow-header">
        <span className="agent-flow-editor__debug-workflow-title">
          <CheckCircleFilled />
          <Typography.Text>工作流</Typography.Text>
        </span>
        <DownOutlined className="agent-flow-editor__debug-workflow-collapse" />
      </div>
      <div className="agent-flow-editor__debug-workflow-list">
        {items.map((item) => (
          <button
            key={item.nodeId}
            className="agent-flow-editor__debug-workflow-row"
            type="button"
            onClick={() => onSelectNode(item.nodeId)}
          >
            <RightOutlined className="agent-flow-editor__debug-workflow-row-caret" />
            <span
              className={`agent-flow-editor__debug-workflow-node-icon agent-flow-editor__debug-workflow-node-icon--${nodeIconTone(item)}`}
            />
            <Typography.Text strong>{nodeDisplayName(item)}</Typography.Text>
            <Typography.Text className="agent-flow-editor__debug-workflow-metric" type="secondary">
              {metricText(item)}
            </Typography.Text>
            <StatusIcon status={item.status} />
          </button>
        ))}
      </div>
    </div>
  );
}
