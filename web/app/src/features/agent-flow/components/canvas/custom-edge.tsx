import type { FlowNodeType } from '@1flowse/flow-schema';
import {
  EdgeLabelRenderer,
  getBezierPath,
  type Edge,
  type EdgeProps
} from '@xyflow/react';
import { useState } from 'react';

import { EdgeInsertButton } from './EdgeInsertButton';

export interface AgentFlowCanvasEdgeData extends Record<string, unknown> {
  onInsertNode?: (edgeId: string, nodeType: FlowNodeType) => void;
}

export type AgentFlowCanvasEdge = Edge<
  AgentFlowCanvasEdgeData,
  'agentFlowEdge'
>;

export function AgentFlowCustomEdge(props: EdgeProps<AgentFlowCanvasEdge>) {
  const {
    id,
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    style,
    markerEnd,
    data,
    selected
  } = props;
  const [pickerOpen, setPickerOpen] = useState(false);
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition
  });

  return (
    <>
      <path
        id={id}
        style={{
          ...style,
          stroke: selected ? '#497a5d' : style?.stroke,
          strokeWidth: selected ? 3 : style?.strokeWidth
        }}
        className="react-flow__edge-path agent-flow-custom-edge-path"
        d={edgePath}
        markerEnd={markerEnd}
      />
      <EdgeLabelRenderer>
        <div
          className="agent-flow-edge-label-container"
          style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            pointerEvents: 'all',
            zIndex: 20,
            boxShadow: selected
              ? '0 0 0 2px rgba(73, 122, 93, 0.18), 0 2px 8px rgba(33, 62, 44, 0.16)'
              : undefined
          }}
        >
          <div className="agent-flow-edge-add-button-wrapper">
            <EdgeInsertButton
              open={pickerOpen}
              onOpenChange={setPickerOpen}
              onPickNode={(nodeType) => {
                data?.onInsertNode?.(id, nodeType);
                setPickerOpen(false);
              }}
            />
          </div>
        </div>
      </EdgeLabelRenderer>
    </>
  );
}
