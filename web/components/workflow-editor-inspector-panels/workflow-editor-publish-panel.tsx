"use client";

import React from "react";
import { Space } from "antd";

import type { SandboxReadinessCheck } from "@/lib/get-system-overview";
import type { OperatorRecommendedNextStep } from "@/lib/operator-follow-up-presenters";
import type { WorkflowValidationNavigatorItem } from "@/lib/workflow-validation-navigation";
import { WorkflowPersistBlockerNotice } from "@/components/workflow-persist-blocker-notice";
import type { WorkflowPersistBlocker } from "@/components/workflow-editor-workbench/persist-blockers";
import { WorkflowEditorPublishForm } from "@/components/workflow-editor-publish-form";

export type WorkflowEditorPublishPanelProps = {
  currentHref?: string | null;
  workflowVersion: string;
  availableWorkflowVersions: string[];
  publishEndpoints: Array<Record<string, unknown>>;
  sandboxReadiness?: SandboxReadinessCheck | null;
  onChange: (
    nextPublish: Array<Record<string, unknown>>,
    options?: { successMessage?: string }
  ) => void;
  focusedValidationItem?: WorkflowValidationNavigatorItem | null;
  persistBlockedMessage?: string | null;
  persistBlockerSummary?: string | null;
  persistBlockers: WorkflowPersistBlocker[];
  persistBlockerRecommendedNextStep?: OperatorRecommendedNextStep | null;
  highlightedEndpointIndex?: number | null;
  highlightedEndpointFieldPath?: string | null;
};

export function WorkflowEditorPublishPanel({
  currentHref = null,
  workflowVersion,
  availableWorkflowVersions,
  publishEndpoints,
  sandboxReadiness,
  onChange,
  focusedValidationItem = null,
  persistBlockedMessage = null,
  persistBlockerSummary = null,
  persistBlockers,
  persistBlockerRecommendedNextStep = null,
  highlightedEndpointIndex = null,
  highlightedEndpointFieldPath = null
}: WorkflowEditorPublishPanelProps) {
  return (
    <Space
      orientation="vertical"
      size="large"
      style={{ width: "100%" }}
      data-component="workflow-editor-publish-panel"
    >
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
        publishEndpoints={publishEndpoints}
        sandboxReadiness={sandboxReadiness}
        onChange={onChange}
        focusedValidationItem={focusedValidationItem}
        persistBlockers={persistBlockers}
        highlightedEndpointIndex={highlightedEndpointIndex}
        highlightedEndpointFieldPath={highlightedEndpointFieldPath}
      />
    </Space>
  );
}
