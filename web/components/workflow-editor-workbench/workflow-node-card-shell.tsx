"use client";

import type { CSSProperties, ReactNode } from "react";
import { PlayCircleOutlined } from "@ant-design/icons";
import { Handle, Position } from "@xyflow/react";

import {
  WorkflowCanvasQuickAddTrigger,
  type WorkflowCanvasQuickAddOption
} from "@/components/workflow-editor-workbench/workflow-canvas-quick-add";

export type WorkflowNodeCardShellProps = {
  id: string;
  selected: boolean;
  label: string;
  typeLabel: string;
  meta: string;
  glyph: string;
  accentColor: string;
  description?: string | null;
  bodyContent?: ReactNode;
  runtimeClassName?: string;
  hasIncomingHandle: boolean;
  hasOutgoingHandle: boolean;
  canDelete: boolean;
  canQuickAdd: boolean;
  canOpenRuntime: boolean;
  quickAddOptions: WorkflowCanvasQuickAddOption[];
  onQuickAdd?: (sourceNodeId: string, type: string) => void;
  onDeleteNode?: (nodeId: string) => void;
  onOpenRuntime?: (nodeId: string) => void;
};

export function WorkflowNodeCardShell({
  id,
  selected,
  label,
  typeLabel,
  meta,
  glyph,
  accentColor,
  description,
  bodyContent,
  runtimeClassName,
  hasIncomingHandle,
  hasOutgoingHandle,
  canDelete,
  canQuickAdd,
  canOpenRuntime,
  quickAddOptions,
  onQuickAdd,
  onDeleteNode,
  onOpenRuntime
}: WorkflowNodeCardShellProps) {
  return (
    <div
      className={`workflow-canvas-node ${selected ? "selected" : ""} ${runtimeClassName ?? ""}`.trim()}
      style={
        {
          "--node-accent": accentColor
        } as CSSProperties
      }
      data-component="workflow-node-card-shell"
    >
      {hasIncomingHandle ? <Handle type="target" position={Position.Left} /> : null}
      {selected && (canOpenRuntime || canDelete) ? (
        <div className="workflow-canvas-node-actions">
          {canOpenRuntime ? (
            <button
              className="workflow-canvas-node-action-button"
              type="button"
              aria-label={`试运行 ${label}`}
              data-action="open-node-runtime-from-node"
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                onOpenRuntime?.(id);
              }}
            >
              <PlayCircleOutlined />
            </button>
          ) : null}
          {canDelete ? (
            <button
              className="workflow-canvas-node-action-button danger"
              type="button"
              aria-label={`删除 ${label}`}
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                onDeleteNode?.(id);
              }}
            >
              ×
            </button>
          ) : null}
        </div>
      ) : null}
      <div className="workflow-canvas-node-head">
        <div className="workflow-canvas-node-icon" aria-hidden="true">
          {glyph}
        </div>
        <div className="workflow-canvas-node-head-copy">
          <div className="workflow-canvas-node-title-row">
            <div className="workflow-canvas-node-label">{label}</div>
            <span className="workflow-canvas-node-kind">{typeLabel}</span>
          </div>
          <div className="workflow-canvas-node-type">{meta}</div>
        </div>
      </div>
      {description ? (
        <div className="workflow-canvas-node-description">{description}</div>
      ) : null}
      {bodyContent ? (
        <div className="workflow-canvas-node-body">{bodyContent}</div>
      ) : null}
      {canQuickAdd ? (
        <WorkflowCanvasQuickAddTrigger
          quickAddOptions={quickAddOptions}
          triggerAriaLabel={`${label} 后添加节点`}
          menuTitle="添加下一个节点"
          menuDescription="直接插入当前节点后方，并自动续上主链。"
          containerClassName="workflow-canvas-node-quick-add"
          triggerClassName="workflow-canvas-node-quick-add-trigger"
          menuClassName="workflow-canvas-node-quick-menu"
          onQuickAdd={(type) => onQuickAdd?.(id, type)}
        />
      ) : null}
      {hasOutgoingHandle ? <Handle type="source" position={Position.Right} /> : null}
    </div>
  );
}
