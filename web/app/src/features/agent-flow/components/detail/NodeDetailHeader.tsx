import { CloseOutlined } from '@ant-design/icons';
import { Button, Input, Space, Typography } from 'antd';

import { nodeDefinitions } from '../../lib/node-definitions';
import { useNodeDetailActions } from '../../hooks/interactions/use-node-detail-actions';
import { useInspectorInteractions } from '../../hooks/interactions/use-inspector-interactions';
import { getNodeDefinitionMeta } from '../../lib/node-definitions';
import { useAgentFlowEditorStore } from '../../store/editor/provider';
import {
  selectSelectedNodeId,
  selectWorkingDocument
} from '../../store/editor/selectors';
import { NodeActionMenu } from './NodeActionMenu';
import { NodeRunButton } from './NodeRunButton';

export function NodeDetailHeader({
  onClose,
  onRunNode
}: {
  onClose: () => void;
  onRunNode?: (() => void) | undefined;
}) {
  const document = useAgentFlowEditorStore(selectWorkingDocument);
  const selectedNodeId = useAgentFlowEditorStore(selectSelectedNodeId);
  const selectedNode = selectedNodeId
    ? document.graph.nodes.find((node) => node.id === selectedNodeId) ?? null
    : null;
  const definition = selectedNode ? nodeDefinitions[selectedNode.type] ?? null : null;
  const definitionMeta = selectedNode
    ? getNodeDefinitionMeta(selectedNode.type)
    : null;
  const detailActions = useNodeDetailActions();
  const { updateField } = useInspectorInteractions();

  if (!selectedNode || !definition || !definitionMeta) {
    return null;
  }

  return (
    <header
      className="agent-flow-node-detail__header"
      data-testid="node-detail-header"
    >
      <div className="agent-flow-node-detail__header-main">
        <Space
          align="center"
          className="agent-flow-node-detail__header-meta"
          size={8}
        >
          <Typography.Title
            className="agent-flow-node-detail__header-type"
            level={4}
          >
            {definition.label}
          </Typography.Title>
          {definitionMeta.helpHref ? (
            <Typography.Link href={definitionMeta.helpHref} target="_blank">
              帮助文档
            </Typography.Link>
          ) : null}
        </Space>
        <Input
          aria-label="节点别名"
          className="agent-flow-editor__inspector-title-input"
          value={selectedNode.alias}
          onChange={(event) => updateField('alias', event.target.value)}
        />
        <Input.TextArea
          aria-label="节点简介"
          autoSize={{ minRows: 1, maxRows: 3 }}
          className="agent-flow-editor__inspector-description-input"
          placeholder="补充该节点的作用与上下文"
          value={selectedNode.description ?? ''}
          onChange={(event) => updateField('description', event.target.value)}
        />
      </div>
      <Space size={4}>
        <NodeRunButton onRunNode={onRunNode} />
        <NodeActionMenu
          onLocate={detailActions.locateSelectedNode}
          onCopy={detailActions.duplicateSelectedNode}
        />
        <Button
          aria-label="关闭节点详情"
          icon={<CloseOutlined />}
          type="text"
          onClick={onClose}
        />
      </Space>
    </header>
  );
}
