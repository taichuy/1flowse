import { Position, type NodeProps } from '@xyflow/react';

import { CanvasHandle } from '../canvas/CanvasHandle';
import { NodePickerPopover } from '../node-picker/NodePickerPopover';
import type { AgentFlowCanvasNode } from '../canvas/node-types';

export function AgentFlowNodeCard({
  data,
  selected
}: NodeProps<AgentFlowCanvasNode>) {
  return (
    <>
      {data.showTargetHandle ? (
        <CanvasHandle
          type="target"
          position={Position.Left}
          className="agent-flow-node-handle agent-flow-node-handle--target"
        />
      ) : null}
      <div
        className={`agent-flow-node-card${selected ? ' agent-flow-node-card--selected' : ''}`}
        role="button"
        tabIndex={0}
        onClick={() => data.onSelectNode(data.nodeId)}
        onDoubleClick={() => {
          if (data.canEnterContainer) {
            data.onOpenContainer(data.nodeId);
          }
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            data.onSelectNode(data.nodeId);
          }
        }}
      >
        <div className="agent-flow-node-card__eyebrow">
          <span>{data.alias === data.typeLabel ? 'Node' : data.typeLabel}</span>
          {data.issueCount > 0 ? (
            <span className="agent-flow-node-card__badge">{data.issueCount}</span>
          ) : null}
        </div>
        <div className="agent-flow-node-card__title">{data.alias}</div>
        {data.description?.trim().length ? (
          <div className="agent-flow-node-card__description">{data.description}</div>
        ) : null}
      </div>
      {data.showSourceHandle ? (
        <NodePickerPopover
          ariaLabel={`在 ${data.alias} 后新增节点`}
          open={data.pickerOpen}
          onOpenChange={(open) => {
            if (open) {
              data.onOpenPicker(data.nodeId);
              return;
            }

            data.onClosePicker();
          }}
          onPickNode={(nodeType) => data.onInsertNode(data.nodeId, nodeType)}
        >
          <CanvasHandle
            type="source"
            position={Position.Right}
            aria-expanded={data.pickerOpen}
            aria-haspopup="menu"
            aria-label={`在 ${data.alias} 后新增节点`}
            className="agent-flow-node-handle agent-flow-node-handle--source"
            role="button"
            tabIndex={0}
            onClick={(event) => {
              event.stopPropagation();
            }}
            onKeyDown={(event) => {
              if (event.key !== 'Enter' && event.key !== ' ') {
                return;
              }

              event.preventDefault();
              event.stopPropagation();

              if (data.pickerOpen) {
                data.onClosePicker();
                return;
              }

              data.onOpenPicker(data.nodeId);
            }}
          >
            <span aria-hidden="true" className="agent-flow-node-handle__icon">
              +
            </span>
          </CanvasHandle>
        </NodePickerPopover>
      ) : null}
    </>
  );
}
