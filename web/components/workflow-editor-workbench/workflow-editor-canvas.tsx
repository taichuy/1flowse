"use client";

import { useState } from "react";

import {
  Background,
  Controls,
  MiniMap,
  Panel,
  ReactFlow,
  ReactFlowProvider,
  type Edge,
  type Node,
  type ReactFlowInstance,
  type NodeTypes,
  type OnConnect,
  type OnEdgesChange,
  type OnNodesChange,
  type OnSelectionChangeParams
} from "@xyflow/react";
import { Button, Space, Tooltip } from "antd";
import {
  AimOutlined,
  AppstoreOutlined,
  EditOutlined,
  NodeIndexOutlined,
  RobotOutlined
} from "@ant-design/icons";

import type {
  WorkflowCanvasEdgeData,
  WorkflowCanvasNodeData
} from "@/lib/workflow-editor";
import { nodeColorByType } from "@/components/workflow-editor-workbench/workflow-canvas-node";

export type WorkflowEditorCanvasProps = {
  nodes: Array<Node<WorkflowCanvasNodeData>>;
  edges: Array<Edge<WorkflowCanvasEdgeData>>;
  nodeTypes: NodeTypes;
  onNodesChange: OnNodesChange<Node<WorkflowCanvasNodeData>>;
  onEdgesChange: OnEdgesChange<Edge<WorkflowCanvasEdgeData>>;
  onConnect: OnConnect;
  onSelectionChange: (params: OnSelectionChangeParams) => void;
  isSidebarOpen: boolean;
  isInspectorOpen: boolean;
  hasSelection: boolean;
  hasNodeAssistant: boolean;
  onToggleSidebar: () => void;
  onToggleInspector: () => void;
  onOpenAssistant: () => void;
};

const FIT_VIEW_OPTIONS = { padding: 0.16, duration: 240 };

export function WorkflowEditorCanvas({
  nodes,
  edges,
  nodeTypes,
  onNodesChange,
  onEdgesChange,
  onConnect,
  onSelectionChange,
  isSidebarOpen,
  isInspectorOpen,
  hasSelection,
  hasNodeAssistant,
  onToggleSidebar,
  onToggleInspector,
  onOpenAssistant
}: WorkflowEditorCanvasProps) {
  const [isMiniMapVisible, setIsMiniMapVisible] = useState(true);
  const [reactFlowInstance, setReactFlowInstance] =
    useState<
      ReactFlowInstance<Node<WorkflowCanvasNodeData>, Edge<WorkflowCanvasEdgeData>> | null
    >(null);
  const inspectorActionLabel = hasSelection ? "属性抽屉" : "应用配置";

  return (
    <ReactFlowProvider>
      <section className="editor-canvas-panel" data-component="workflow-editor-canvas">
        <div className="editor-canvas-card">
          <ReactFlow
            fitView
            fitViewOptions={FIT_VIEW_OPTIONS}
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onSelectionChange={onSelectionChange}
            onInit={(instance) => setReactFlowInstance(instance)}
            deleteKeyCode={["Delete", "Backspace"]}
            onlyRenderVisibleElements
            minZoom={0.4}
            maxZoom={1.5}
            className="editor-canvas"
          >
            <Panel className="workflow-editor-action-strip-panel" position="top-right">
              <Space
                size={8}
                wrap
                className="workflow-editor-action-strip"
                data-component="workflow-editor-action-strip"
              >
                <Button
                  type={isSidebarOpen ? "primary" : "default"}
                  icon={<AppstoreOutlined />}
                  className="workflow-editor-action-strip-button"
                  data-action="node-library"
                  onClick={onToggleSidebar}
                >
                  节点目录
                </Button>
                <Button
                  type={isInspectorOpen ? "primary" : "default"}
                  icon={<EditOutlined />}
                  className="workflow-editor-action-strip-button"
                  data-action="inspector"
                  onClick={onToggleInspector}
                >
                  {inspectorActionLabel}
                </Button>
                {hasNodeAssistant ? (
                  <Button
                    icon={<RobotOutlined />}
                    className="workflow-editor-action-strip-button"
                    data-action="assistant"
                    onClick={onOpenAssistant}
                  >
                    AI 辅助
                  </Button>
                ) : null}
                <Tooltip title="让当前节点图重新回到主视野">
                  <Button
                    icon={<AimOutlined />}
                    className="workflow-editor-action-strip-button"
                    data-action="fit-view"
                    onClick={() => {
                      void reactFlowInstance?.fitView(FIT_VIEW_OPTIONS);
                    }}
                  >
                    适配视图
                  </Button>
                </Tooltip>
                <Button
                  type={isMiniMapVisible ? "default" : "text"}
                  icon={<NodeIndexOutlined />}
                  className="workflow-editor-action-strip-button"
                  data-action="minimap"
                  onClick={() => setIsMiniMapVisible((current) => !current)}
                >
                  {isMiniMapVisible ? "隐藏地图" : "显示地图"}
                </Button>
              </Space>
            </Panel>
            <Panel className="workflow-canvas-helper-panel" position="top-left">
              <strong>xyflow Studio</strong>
              <span>选中节点后可插入下一节点，或用 ··· 打开配置。</span>
            </Panel>
            <Background gap={24} size={1} />
            {isMiniMapVisible ? (
              <MiniMap
                pannable
                zoomable
                nodeColor={(node) => nodeColorByType((node.data as WorkflowCanvasNodeData).nodeType)}
              />
            ) : null}
            <Controls />
          </ReactFlow>
        </div>
      </section>
    </ReactFlowProvider>
  );
}
