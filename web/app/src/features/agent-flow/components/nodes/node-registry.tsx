import type { Edge, Node, NodeTypes } from '@xyflow/react';
import type { FlowAuthoringDocument, FlowNodeType } from '@1flowse/flow-schema';

import { AgentFlowNodeCard } from './AgentFlowNodeCard';

function nodeTypeLabel(nodeType: FlowNodeType) {
  if (nodeType === 'llm') {
    return 'LLM';
  }

  return nodeType
    .split('_')
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ');
}

export interface AgentFlowCanvasNodeData extends Record<string, unknown> {
  nodeId: string;
  typeLabel: string;
  alias: string;
  issueCount: number;
  pickerOpen: boolean;
  onOpenPicker: (nodeId: string) => void;
  onClosePicker: () => void;
  onSelectNode: (nodeId: string) => void;
  onInsertNode: (nodeId: string, nodeType: FlowNodeType) => void;
}

export type AgentFlowCanvasNode = Node<AgentFlowCanvasNodeData, 'agentFlowNode'>;

export const agentFlowNodeTypes: NodeTypes = {
  agentFlowNode: AgentFlowNodeCard
};

export function toCanvasNodes(
  document: FlowAuthoringDocument,
  selectedNodeId: string | null,
  pickerNodeId: string | null,
  issueCountByNodeId: Record<string, number>,
  actions: Pick<
    AgentFlowCanvasNodeData,
    'onOpenPicker' | 'onClosePicker' | 'onSelectNode' | 'onInsertNode'
  >
): AgentFlowCanvasNode[] {
  return document.graph.nodes.map((node) => ({
    id: node.id,
    type: 'agentFlowNode',
    selected: node.id === selectedNodeId,
    position: node.position,
    width: 196,
    height: 96,
    data: {
      nodeId: node.id,
      typeLabel: nodeTypeLabel(node.type),
      alias: node.alias,
      issueCount: issueCountByNodeId[node.id] ?? 0,
      pickerOpen: pickerNodeId === node.id,
      ...actions
    }
  }));
}

export function toCanvasEdges(document: FlowAuthoringDocument): Edge[] {
  return document.graph.edges.map((edge) => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    sourceHandle: edge.sourceHandle,
    targetHandle: edge.targetHandle,
    animated: false
  }));
}
