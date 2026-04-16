import { Card, Empty, List, Tag, Typography } from 'antd';

import { useAgentFlowEditorStore } from '../../../store/editor/provider';
import {
  selectSelectedNodeId,
  selectWorkingDocument
} from '../../../store/editor/selectors';

export function NodeOutputContractCard() {
  const document = useAgentFlowEditorStore(selectWorkingDocument);
  const selectedNodeId = useAgentFlowEditorStore(selectSelectedNodeId);
  const selectedNode = selectedNodeId
    ? document.graph.nodes.find((node) => node.id === selectedNodeId) ?? null
    : null;

  if (!selectedNode) {
    return null;
  }

  return (
    <Card title="输出契约">
      {selectedNode.outputs.length > 0 ? (
        <List
          dataSource={selectedNode.outputs}
          renderItem={(output) => (
            <List.Item>
              <div className="agent-flow-node-detail__output-contract-item">
                <Typography.Text>{output.title}</Typography.Text>
                <Typography.Text type="secondary">{output.key}</Typography.Text>
              </div>
              <Tag>{output.valueType}</Tag>
            </List.Item>
          )}
        />
      ) : (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="当前节点未声明输出变量"
        />
      )}
    </Card>
  );
}
