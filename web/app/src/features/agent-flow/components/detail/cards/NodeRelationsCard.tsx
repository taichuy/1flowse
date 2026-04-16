import { Card, Empty, Space, Tag, Typography } from 'antd';

import {
  getDirectDownstreamNodes,
  getDirectUpstreamNodes
} from '../../../lib/document/relations';
import { useAgentFlowEditorStore } from '../../../store/editor/provider';
import {
  selectSelectedNodeId,
  selectWorkingDocument
} from '../../../store/editor/selectors';

function RelationTagList({
  emptyText,
  title,
  nodeLabels
}: {
  emptyText: string;
  title: string;
  nodeLabels: string[];
}) {
  return (
    <div>
      <Typography.Text strong>{title}</Typography.Text>
      {nodeLabels.length > 0 ? (
        <Space size={[8, 8]} wrap>
          {nodeLabels.map((label) => (
            <Tag key={label}>{label}</Tag>
          ))}
        </Space>
      ) : (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={emptyText}
        />
      )}
    </div>
  );
}

export function NodeRelationsCard() {
  const document = useAgentFlowEditorStore(selectWorkingDocument);
  const selectedNodeId = useAgentFlowEditorStore(selectSelectedNodeId);

  if (!selectedNodeId) {
    return null;
  }

  const upstreamNodes = getDirectUpstreamNodes(document, selectedNodeId);
  const downstreamNodes = getDirectDownstreamNodes(document, selectedNodeId);

  return (
    <Card title="节点关系">
      <Space direction="vertical" size={16}>
        <RelationTagList
          emptyText="当前节点没有直接上游"
          nodeLabels={upstreamNodes.map((node) => node.alias)}
          title="上游节点"
        />
        <RelationTagList
          emptyText="当前节点没有直接下游"
          nodeLabels={downstreamNodes.map((node) => node.alias)}
          title="下游节点"
        />
        <Typography.Text type="secondary">
          当前节点可以在输入绑定中引用当前作用域下所有可见上游输出变量。
        </Typography.Text>
      </Space>
    </Card>
  );
}
