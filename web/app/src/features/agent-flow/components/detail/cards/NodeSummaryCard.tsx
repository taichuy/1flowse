import { Card, Input, Space, Typography } from 'antd';

import { useInspectorInteractions } from '../../../hooks/interactions/use-inspector-interactions';
import {
  getNodeDefinitionMeta,
  nodeDefinitions
} from '../../../lib/node-definitions';
import { useAgentFlowEditorStore } from '../../../store/editor/provider';
import {
  selectSelectedNodeId,
  selectWorkingDocument
} from '../../../store/editor/selectors';

export function NodeSummaryCard() {
  const document = useAgentFlowEditorStore(selectWorkingDocument);
  const selectedNodeId = useAgentFlowEditorStore(selectSelectedNodeId);
  const { updateField } = useInspectorInteractions();
  const selectedNode = selectedNodeId
    ? document.graph.nodes.find((node) => node.id === selectedNodeId) ?? null
    : null;
  const definition = selectedNode ? nodeDefinitions[selectedNode.type] ?? null : null;
  const definitionMeta = selectedNode
    ? getNodeDefinitionMeta(selectedNode.type)
    : null;

  if (!selectedNode || !definition || !definitionMeta) {
    return null;
  }

  return (
    <Card
      extra={
        definitionMeta.helpHref ? (
          <Typography.Link href={definitionMeta.helpHref} target="_blank">
            帮助文档
          </Typography.Link>
        ) : null
      }
      title="节点说明"
    >
      <Space className="agent-flow-node-detail__summary-fields" direction="vertical" size={12}>
        <Typography.Paragraph>{definition.summary ?? definitionMeta.summary}</Typography.Paragraph>
        <div>
          <Typography.Text strong>节点别名</Typography.Text>
          <Input
            aria-label="节点别名"
            value={selectedNode.alias}
            onChange={(event) => updateField('alias', event.target.value)}
          />
        </div>
        <div>
          <Typography.Text strong>节点简介</Typography.Text>
          <Input.TextArea
            aria-label="节点简介"
            autoSize={{ minRows: 2, maxRows: 4 }}
            value={selectedNode.description ?? ''}
            onChange={(event) => updateField('description', event.target.value)}
          />
        </div>
      </Space>
    </Card>
  );
}
