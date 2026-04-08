"use client";

import * as React from "react";
import type { ReactNode } from "react";
import { Collapse, Space } from "antd";

export type WorkflowNodeSettingsTemplateProps = {
  featureSection: ReactNode;
  contractSection?: ReactNode;
  runtimePolicySection?: ReactNode;
  rawJsonSection?: ReactNode;
  showAdvanced: boolean;
  expandedSectionKeys: string[];
  onExpandedSectionKeysChange: (keys: string[]) => void;
};

export function WorkflowNodeSettingsTemplate({
  featureSection,
  contractSection,
  runtimePolicySection,
  rawJsonSection,
  showAdvanced,
  expandedSectionKeys,
  onExpandedSectionKeysChange
}: WorkflowNodeSettingsTemplateProps) {
  if (!showAdvanced) {
    return (
      <Space
        orientation="vertical"
        size={20}
        style={{ width: "100%" }}
        className="workflow-editor-node-settings-panel"
        data-component="workflow-node-settings-template"
      >
        {featureSection}
      </Space>
    );
  }

  return (
    <Space
      orientation="vertical"
      size={20}
      style={{ width: "100%" }}
      className="workflow-editor-node-settings-panel"
      data-component="workflow-node-settings-template"
    >
      {featureSection}
      <Collapse
        activeKey={expandedSectionKeys}
        onChange={(keys) =>
          onExpandedSectionKeysChange(Array.isArray(keys) ? keys.map(String) : [String(keys)])
        }
        className="workflow-editor-node-settings-advanced"
        items={[
          {
            key: "advanced",
            label: "高级设置",
            children: (
              <Space
                orientation="vertical"
                size={20}
                style={{ width: "100%" }}
                className="workflow-editor-node-settings-advanced-content"
              >
                {contractSection}
                {runtimePolicySection}
              </Space>
            )
          },
          {
            key: "json",
            label: "原始 JSON",
            children: rawJsonSection
          }
        ]}
      />
    </Space>
  );
}
