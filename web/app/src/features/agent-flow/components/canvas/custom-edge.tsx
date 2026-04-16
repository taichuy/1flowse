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
    data
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
        style={style}
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
            zIndex: 20
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
