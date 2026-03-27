"use client";

import React from "react";
import type { Edge, Node } from "@xyflow/react";
import { Typography, Tabs, Input, Button, Space, Tag, Empty } from "antd";

import type {
  PluginAdapterRegistryItem,
  PluginToolRegistryItem
} from "@/lib/get-plugin-registry";
import type { SandboxReadinessCheck } from "@/lib/get-system-overview";
import type { OperatorRecommendedNextStep } from "@/lib/operator-follow-up-presenters";
import type { WorkflowValidationNavigatorItem } from "@/lib/workflow-validation-navigation";
import type {
  WorkflowCanvasEdgeData,
  WorkflowCanvasNodeData
} from "@/lib/workflow-editor";
import type { WorkflowPersistBlocker } from "@/components/workflow-editor-workbench/persist-blockers";
import { WorkflowNodeConfigForm } from "@/components/workflow-node-config-form";
import { WorkflowNodeIoSchemaForm } from "@/components/workflow-node-config-form/node-io-schema-form";
import { WorkflowNodeRuntimePolicyForm } from "@/components/workflow-node-config-form/runtime-policy-form";
import { WorkflowPersistBlockerNotice } from "@/components/workflow-persist-blocker-notice";
import { WorkflowEditorPublishForm } from "@/components/workflow-editor-publish-form";
import { WorkflowEditorVariableForm } from "@/components/workflow-editor-variable-form";

const { Title, Text } = Typography;
const { TextArea } = Input;

type WorkflowEditorInspectorProps = {
  currentHref?: string | null;
  selectedNode: Node<WorkflowCanvasNodeData> | null;
  selectedEdge: Edge<WorkflowCanvasEdgeData> | null;
  nodes: Array<Node<WorkflowCanvasNodeData>>;
  edges: Array<Edge<WorkflowCanvasEdgeData>>;
  tools: PluginToolRegistryItem[];
  adapters: PluginAdapterRegistryItem[];
  nodeConfigText: string;
  onNodeConfigTextChange: (value: string) => void;
  onApplyNodeConfigJson: () => void;
  onNodeNameChange: (value: string) => void;
  onNodeConfigChange: (nextConfig: Record<string, unknown>) => void;
  onNodeInputSchemaChange: (nextSchema: Record<string, unknown> | undefined) => void;
  onNodeOutputSchemaChange: (nextSchema: Record<string, unknown> | undefined) => void;
  onNodeRuntimePolicyUpdate: (nextRuntimePolicy: Record<string, unknown> | undefined) => void;
  onNodeRuntimePolicyChange: (value: string) => void;
  workflowVersion: string;
  availableWorkflowVersions: string[];
  workflowVariables: Array<Record<string, unknown>>;
  workflowPublish: Array<Record<string, unknown>>;
  onWorkflowVariablesChange: (
    nextVariables: Array<Record<string, unknown>>,
    options?: { successMessage?: string }
  ) => void;
  onWorkflowPublishChange: (
    nextPublish: Array<Record<string, unknown>>,
    options?: { successMessage?: string }
  ) => void;
  onDeleteSelectedNode: () => void;
  onUpdateSelectedEdge: (
    patch: Partial<WorkflowCanvasEdgeData> & { label?: string | undefined }
  ) => void;
  onDeleteSelectedEdge: () => void;
  highlightedNodeSection?: "config" | "contract" | "runtime" | null;
  highlightedNodeFieldPath?: string | null;
  highlightedPublishEndpointIndex?: number | null;
  highlightedPublishEndpointFieldPath?: string | null;
  highlightedVariableIndex?: number | null;
  highlightedVariableFieldPath?: string | null;
  focusedValidationItem?: WorkflowValidationNavigatorItem | null;
  persistBlockedMessage?: string | null;
  persistBlockerSummary?: string | null;
  persistBlockers: WorkflowPersistBlocker[];
  persistBlockerRecommendedNextStep?: OperatorRecommendedNextStep | null;
  sandboxReadiness?: SandboxReadinessCheck | null;
};

export function WorkflowEditorInspector({
  currentHref = null,
  selectedNode,
  selectedEdge,
  nodes,
  edges,
  tools,
  adapters,
  nodeConfigText,
  onNodeConfigTextChange,
  onApplyNodeConfigJson,
  onNodeNameChange,
  onNodeConfigChange,
  onNodeInputSchemaChange,
  onNodeOutputSchemaChange,
  onNodeRuntimePolicyUpdate,
  onNodeRuntimePolicyChange,
  workflowVersion,
  availableWorkflowVersions,
  workflowVariables,
  workflowPublish,
  onWorkflowVariablesChange,
  onWorkflowPublishChange,
  onDeleteSelectedNode,
  onUpdateSelectedEdge,
  onDeleteSelectedEdge,
  highlightedNodeSection = null,
  highlightedNodeFieldPath = null,
  highlightedPublishEndpointIndex = null,
  highlightedPublishEndpointFieldPath = null,
  highlightedVariableIndex = null,
  highlightedVariableFieldPath = null,
  focusedValidationItem = null,
  persistBlockedMessage = null,
  persistBlockerSummary = null,
  persistBlockers,
  persistBlockerRecommendedNextStep = null,
  sandboxReadiness
}: WorkflowEditorInspectorProps) {
  return (
    <div style={{ background: '#fff', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '16px 20px', borderBottom: '1px solid #e5e7eb', background: '#f9fafb' }}>
        <Title level={5} style={{ margin: 0 }}>属性与配置</Title>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
        <Tabs defaultActiveKey="1" items={[
          {
            key: '1',
            label: '节点/连线',
            children: selectedNode ? (
              <Space direction="vertical" size="large" style={{ width: '100%' }}>
                <Space>
                  <Tag color="blue">{selectedNode.data.nodeType}</Tag>
                  <Text type="secondary" style={{ fontSize: 12 }}>{selectedNode.id}</Text>
                </Space>
    
                <div>
                  <div style={{ marginBottom: 8, fontWeight: 500 }}>节点名称</div>
                  <Input
                    value={selectedNode.data.label}
                    onChange={(event) => onNodeNameChange(event.target.value)}
                  />
                </div>
    
                <WorkflowNodeConfigForm
                  node={selectedNode}
                  nodes={nodes}
                  tools={tools}
                  adapters={adapters}
                  currentHref={currentHref}
                  sandboxReadiness={sandboxReadiness}
                  highlightedFieldPath={highlightedNodeSection === "config" ? highlightedNodeFieldPath : null}
                  focusedValidationItem={
                    highlightedNodeSection === "config" ? focusedValidationItem : null
                  }
                  onChange={onNodeConfigChange}
                />
    
                <WorkflowNodeIoSchemaForm
                  node={selectedNode}
                  currentHref={currentHref}
                  onInputSchemaChange={onNodeInputSchemaChange}
                  onOutputSchemaChange={onNodeOutputSchemaChange}
                  highlighted={highlightedNodeSection === "contract"}
                  highlightedFieldPath={
                    highlightedNodeSection === "contract" ? highlightedNodeFieldPath : null
                  }
                  focusedValidationItem={
                    highlightedNodeSection === "contract" ? focusedValidationItem : null
                  }
                  sandboxReadiness={sandboxReadiness}
                />
    
                <div>
                  <div style={{ marginBottom: 8, fontWeight: 500 }}>高级 config JSON</div>
                  <TextArea
                    rows={4}
                    value={nodeConfigText}
                    onChange={(event) => onNodeConfigTextChange(event.target.value)}
                  />
                  <Button type="default" style={{ marginTop: 8 }} onClick={onApplyNodeConfigJson}>
                    应用配置
                  </Button>
                </div>
    
                <WorkflowNodeRuntimePolicyForm
                  node={selectedNode}
                  nodes={nodes}
                  edges={edges}
                  currentHref={currentHref}
                  onChange={onNodeRuntimePolicyUpdate}
                  highlighted={highlightedNodeSection === "runtime"}
                  highlightedFieldPath={
                    highlightedNodeSection === "runtime" ? highlightedNodeFieldPath : null
                  }
                  focusedValidationItem={
                    highlightedNodeSection === "runtime" ? focusedValidationItem : null
                  }
                  sandboxReadiness={sandboxReadiness}
                />
    
                <Button danger onClick={onDeleteSelectedNode} style={{ width: '100%' }}>
                  删除节点
                </Button>
              </Space>
            ) : selectedEdge ? (
              <Space direction="vertical" size="large" style={{ width: '100%' }}>
                <Space>
                  <Tag color="purple">edge</Tag>
                  <Text type="secondary" style={{ fontSize: 12 }}>{selectedEdge.id}</Text>
                </Space>
                
                <div>
                  <div style={{ marginBottom: 8, fontWeight: 500 }}>分支标签 (Condition)</div>
                  <Input
                    value={selectedEdge.data?.condition ?? ""}
                    onChange={(event) => onUpdateSelectedEdge({ 
                      condition: event.target.value,
                      label: event.target.value.trim() || undefined
                    })}
                    placeholder="可选的分支说明"
                  />
                </div>
    
                <Button danger onClick={onDeleteSelectedEdge} style={{ width: '100%' }}>
                  删除连线
                </Button>
              </Space>
            ) : (
              <Empty description="在画布中选择节点或连线以查看属性" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            )
          },
          {
            key: '2',
            label: '全局变量',
            children: (
              <WorkflowEditorVariableForm
                currentHref={currentHref}
                variables={workflowVariables}
                onChange={onWorkflowVariablesChange}
                highlightedVariableIndex={highlightedVariableIndex}
                highlightedVariableFieldPath={highlightedVariableFieldPath}
                focusedValidationItem={focusedValidationItem}
                sandboxReadiness={sandboxReadiness}
              />
            )
          },
          {
            key: '3',
            label: '发布配置',
            children: (
              <Space direction="vertical" size="large" style={{ width: '100%' }}>
                {persistBlockedMessage ? (
                  <WorkflowPersistBlockerNotice
                    title="Publish gate"
                    summary={persistBlockerSummary ?? persistBlockedMessage}
                    blockers={persistBlockers}
                    sandboxReadiness={sandboxReadiness}
                    currentHref={currentHref}
                    hideRecommendedNextStep={Boolean(persistBlockerRecommendedNextStep)}
                  />
                ) : null}
        
                <WorkflowEditorPublishForm
                  currentHref={currentHref}
                  workflowVersion={workflowVersion}
                  availableWorkflowVersions={availableWorkflowVersions}
                  publishEndpoints={workflowPublish}
                  sandboxReadiness={sandboxReadiness}
                  onChange={onWorkflowPublishChange}
                  focusedValidationItem={
                    focusedValidationItem?.target.scope === "publish" ? focusedValidationItem : null
                  }
                  persistBlockers={persistBlockers}
                  highlightedEndpointIndex={highlightedPublishEndpointIndex}
                  highlightedEndpointFieldPath={highlightedPublishEndpointFieldPath}
                />
              </Space>
            )
          }
        ]} />
      </div>
    </div>
  );
}

function stringifyJson(value: unknown) {
  return JSON.stringify(value ?? {}, null, 2);
}
