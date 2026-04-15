import { MarkerType, type Edge, type EdgeProps, type Node, type NodeTypes, getBezierPath, EdgeLabelRenderer } from '@xyflow/react';
import type { FlowAuthoringDocument, FlowNodeType } from '@1flowse/flow-schema';

import { AgentFlowNodeCard } from './AgentFlowNodeCard';
import { NodePickerPopover } from '../node-picker/NodePickerPopover';
import { useState } from 'react';

export function AgentFlowEdgeCard(props: EdgeProps) {
  const { id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, style, markerEnd, source } = props;
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });
  const [pickerOpen, setPickerOpen] = useState(false);

  return (
    <>
      <path
        id={id}
        style={style}
        className="react-flow__edge-path agent-flow-custom-edge-path"
        d={edgePath}
        markerEnd={markerEnd}
      />
      <EdgeLabelRenderer>
        <div
          style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            pointerEvents: 'all',
            zIndex: 20
          }}
          className="agent-flow-edge-label-container"
        >
          <div className="agent-flow-edge-add-button-wrapper">
            <NodePickerPopover
              ariaLabel="在此连线上新增节点"
              open={pickerOpen}
              onOpenChange={setPickerOpen}
              onPickNode={(nodeType) => {
                // Not ideal to access reactFlow state directly like this for insertion,
                // but we can trigger a custom event or let the canvas handle it if we pass it down.
                // For now we'll just dispatch a custom event.
                const event = new CustomEvent('agent-flow-insert-node', {
                  detail: { sourceNodeId: source, nodeType, edgeId: id }
                });
                window.dispatchEvent(event);
                setPickerOpen(false);
              }}
            />
          </div>
        </div>
      </EdgeLabelRenderer>
    </>
  );
}

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
  nodeType: FlowNodeType;
  typeLabel: string;
  alias: string;
  description?: string;
  issueCount: number;
  canEnterContainer: boolean;
  pickerOpen: boolean;
  showTargetHandle: boolean;
  onOpenPicker: (nodeId: string) => void;
  onClosePicker: () => void;
  onOpenContainer: (nodeId: string) => void;
  onSelectNode: (nodeId: string) => void;
  onInsertNode: (nodeId: string, nodeType: FlowNodeType) => void;
}

export type AgentFlowCanvasNode = Node<AgentFlowCanvasNodeData, 'agentFlowNode'>;

export const agentFlowNodeTypes: NodeTypes = {
  agentFlowNode: AgentFlowNodeCard
};

export const agentFlowEdgeTypes = {
  agentFlowEdge: AgentFlowEdgeCard
};

export function toCanvasNodes(
  document: FlowAuthoringDocument,
  activeContainerId: string | null,
  selectedNodeId: string | null,
  pickerNodeId: string | null,
  issueCountByNodeId: Record<string, number>,
  actions: Pick<
    AgentFlowCanvasNodeData,
    | 'onOpenPicker'
    | 'onClosePicker'
    | 'onOpenContainer'
    | 'onSelectNode'
    | 'onInsertNode'
  >
): AgentFlowCanvasNode[] {
  return document.graph.nodes
    .filter((node) => node.containerId === activeContainerId)
    .map((node) => ({
      id: node.id,
      type: 'agentFlowNode',
      selected: node.id === selectedNodeId,
      position: node.position,
      width: 196,
      height: 96,
      data: {
        nodeId: node.id,
        nodeType: node.type,
        typeLabel: nodeTypeLabel(node.type),
        alias: node.alias,
        description: node.description,
        issueCount: issueCountByNodeId[node.id] ?? 0,
        canEnterContainer: node.type === 'iteration' || node.type === 'loop',
        pickerOpen: pickerNodeId === node.id,
        showTargetHandle: node.type !== 'start',
        ...actions
      }
    }));
}

export function toCanvasEdges(
  document: FlowAuthoringDocument,
  activeContainerId: string | null
): Edge[] {
  const visibleNodeIds = new Set(
    document.graph.nodes
      .filter((node) => node.containerId === activeContainerId)
      .map((node) => node.id)
  );

  return document.graph.edges
    .filter(
      (edge) =>
        edge.containerId === activeContainerId &&
        visibleNodeIds.has(edge.source) &&
        visibleNodeIds.has(edge.target)
    )
    .map((edge) => ({
      id: edge.id,
      type: 'agentFlowEdge',
      source: edge.source,
      target: edge.target,
      sourceHandle: edge.sourceHandle,
      targetHandle: edge.targetHandle,
      animated: false,
      style: { stroke: '#b2c8b9', strokeWidth: 2 },
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: '#b2c8b9'
      }
    }));
}
