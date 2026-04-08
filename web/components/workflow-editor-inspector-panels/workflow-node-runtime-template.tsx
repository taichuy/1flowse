"use client";

import * as React from "react";
import type { ReactNode } from "react";
import { Space } from "antd";

export type WorkflowNodeRuntimeTemplateProps = {
  summarySection: ReactNode;
  inputSection?: ReactNode;
  trialRunSection?: ReactNode;
  outputSection?: ReactNode;
  contractSection?: ReactNode;
};

export function WorkflowNodeRuntimeTemplate({
  summarySection,
  inputSection,
  trialRunSection,
  outputSection,
  contractSection
}: WorkflowNodeRuntimeTemplateProps) {
  return (
    <Space
      orientation="vertical"
      size={24}
      style={{ width: "100%" }}
      data-component="workflow-node-runtime-template"
    >
      <div data-component="workflow-node-runtime-summary">{summarySection}</div>
      {inputSection ? (
        <div data-component="workflow-node-runtime-input-section">{inputSection}</div>
      ) : null}
      {trialRunSection ? (
        <div data-component="workflow-node-runtime-trial-section">{trialRunSection}</div>
      ) : null}
      {outputSection ? (
        <div data-component="workflow-node-runtime-output-section">{outputSection}</div>
      ) : null}
      {contractSection}
    </Space>
  );
}
