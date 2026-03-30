"use client";

import React from "react";
import { Button, Input, Space, Typography } from "antd";

const { Text } = Typography;
const { TextArea } = Input;

export type WorkflowEditorJsonPanelProps = {
  nodeConfigText: string;
  onNodeConfigTextChange: (value: string) => void;
  onApplyNodeConfigJson: () => void;
  onDeleteSelectedNode: () => void;
};

export function WorkflowEditorJsonPanel({
  nodeConfigText,
  onNodeConfigTextChange,
  onApplyNodeConfigJson,
  onDeleteSelectedNode
}: WorkflowEditorJsonPanelProps) {
  return (
    <Space
      orientation="vertical"
      size="large"
      style={{ width: "100%" }}
      data-component="workflow-editor-node-json-panel"
    >
      <div className="workflow-editor-inspector-section">
        <div className="workflow-editor-inspector-section-title">高级 config JSON</div>
        <Text type="secondary">
          仅在需要精准调整字段时使用，默认仍优先走上面的结构化表单。
        </Text>
      </div>
      <TextArea
        rows={8}
        value={nodeConfigText}
        onChange={(event) => onNodeConfigTextChange(event.target.value)}
      />
      <div className="workflow-editor-inspector-json-actions">
        <Button type="default" onClick={onApplyNodeConfigJson}>
          应用配置
        </Button>
        <Button danger onClick={onDeleteSelectedNode}>
          删除节点
        </Button>
      </div>
    </Space>
  );
}
