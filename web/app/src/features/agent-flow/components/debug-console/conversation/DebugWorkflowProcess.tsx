import { useState } from 'react';
import {
  CheckCircleFilled,
  DownOutlined,
  LoadingOutlined,
  RightOutlined,
  WarningFilled
} from '@ant-design/icons';
import { Collapse, Tag, Typography } from 'antd';

import type { AgentFlowTraceItem } from '../../../api/runtime';
import { getAgentFlowNodeTypeIcon } from '../../../lib/node-type-icons';

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

  if (tone === 'error' || tone === 'warning') {
    return (
      <WarningFilled
        className={`agent-flow-editor__debug-workflow-status-icon agent-flow-editor__debug-workflow-status-icon--${tone}`}
      />
    );
  }

  return (
    <CheckCircleFilled
      className={`agent-flow-editor__debug-workflow-status-icon agent-flow-editor__debug-workflow-status-icon--${tone}`}
    />
  );
}

function hasPayload(payload: Record<string, unknown> | null) {
  return Boolean(payload && Object.keys(payload).length > 0);
}

function PayloadBlock({
  payload,
  title
}: {
  payload: Record<string, unknown> | null;
  title: string;
}) {
  return (
    <section className="agent-flow-editor__debug-workflow-payload">
      <Typography.Text className="agent-flow-editor__debug-workflow-payload-title" strong>
        {title}
      </Typography.Text>
      {hasPayload(payload) ? (
        <pre className="agent-flow-editor__debug-workflow-payload-value">
          {JSON.stringify(payload, null, 2)}
        </pre>
      ) : (
        <Typography.Text type="secondary">无数据</Typography.Text>
      )}
    </section>
  );
}

function NodeTypeIcon({ nodeType }: { nodeType: string }) {
  return (
    <span
      aria-label={`${nodeType} 节点类型`}
      className="agent-flow-editor__debug-workflow-node-icon"
      role="img"
    >
      {getAgentFlowNodeTypeIcon(nodeType)}
    </span>
  );
}

export function DebugWorkflowProcess({
  items
}: {
  items: AgentFlowTraceItem[];
}) {
  const [expanded, setExpanded] = useState(true);

  if (items.length === 0) {
    return null;
  }

  return (
    <div
      aria-label="工作流"
      className="agent-flow-editor__debug-workflow-process"
      role="group"
    >
      <button
        aria-expanded={expanded}
        className="agent-flow-editor__debug-workflow-header"
        onClick={() => setExpanded((current) => !current)}
        type="button"
      >
        <span className="agent-flow-editor__debug-workflow-title">
          <CheckCircleFilled />
          <Typography.Text>工作流</Typography.Text>
        </span>
        {expanded ? (
          <DownOutlined className="agent-flow-editor__debug-workflow-collapse" />
        ) : (
          <RightOutlined className="agent-flow-editor__debug-workflow-collapse" />
        )}
      </button>
      {expanded ? (
        <Collapse
          bordered={false}
          className="agent-flow-editor__debug-workflow-collapse-list"
          expandIconPosition="end"
          items={items.map((item) => ({
            key: item.nodeId,
            label: (
              <span className="agent-flow-editor__debug-workflow-row">
                <NodeTypeIcon nodeType={item.nodeType} />
                <span className="agent-flow-editor__debug-workflow-node-main">
                  <Typography.Text strong>{nodeDisplayName(item)}</Typography.Text>
                  <Typography.Text className="agent-flow-editor__debug-workflow-metric" type="secondary">
                    {metricText(item)}
                  </Typography.Text>
                </span>
                <Tag className="agent-flow-editor__debug-workflow-node-type">{item.nodeType}</Tag>
                <StatusIcon status={item.status} />
              </span>
            ),
            children: (
              <div className="agent-flow-editor__debug-workflow-node-detail">
                <PayloadBlock payload={item.inputPayload} title="输入" />
                <PayloadBlock payload={item.outputPayload} title="输出" />
                <PayloadBlock payload={item.errorPayload} title="错误" />
                <PayloadBlock payload={item.metricsPayload} title="指标" />
              </div>
            )
          }))}
        />
      ) : null}
    </div>
  );
}
