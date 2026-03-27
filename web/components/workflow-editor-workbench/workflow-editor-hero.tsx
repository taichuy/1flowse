"use client";

import React, { useState } from "react";
import { Button, Space, Typography, Tag, Badge, Tooltip, Input } from "antd";
import { SaveOutlined, PlayCircleOutlined, WarningOutlined, EditOutlined } from "@ant-design/icons";

import { OperatorRecommendedNextStepCard } from "@/components/operator-recommended-next-step-card";
import { WorkflowPersistBlockerNotice } from "@/components/workflow-persist-blocker-notice";
import { WorkbenchEntryLink, WorkbenchEntryLinks } from "@/components/workbench-entry-links";
import type { OperatorRecommendedNextStep } from "@/lib/operator-follow-up-presenters";
import { buildWorkflowEditorHeroSurfaceCopy } from "@/lib/workbench-entry-surfaces";
import type { UnsupportedWorkflowNodeSummary } from "@/lib/workflow-node-catalog";
import type { WorkflowPersistBlocker } from "./persist-blockers";

const { Text } = Typography;

type WorkflowEditorHeroProps = {
  currentHref?: string | null;
  workflowId: string;
  workflowName: string;
  onWorkflowNameChange: (name: string) => void;
  workflowVersion: string;
  nodesCount: number;
  edgesCount: number;
  toolsCount: number;
  availableRunsCount: number;
  isDirty: boolean;
  selectedNodeLabel: string | null;
  selectedEdgeId: string | null;
  workflowsCount: number;
  selectedRunAttached: boolean;
  plannedNodeLabels: string[];
  unsupportedNodes: UnsupportedWorkflowNodeSummary[];
  contractValidationIssuesCount: number;
  toolReferenceValidationIssuesCount: number;
  nodeExecutionValidationIssuesCount: number;
  toolExecutionValidationIssuesCount: number;
  publishDraftValidationIssuesCount: number;
  persistBlockedMessage: string | null;
  persistBlockerSummary: string | null;
  persistBlockers: WorkflowPersistBlocker[];
  persistBlockerRecommendedNextStep?: OperatorRecommendedNextStep | null;
  isSaving: boolean;
  isSavingStarter: boolean;
  workflowLibraryHref?: string;
  createWorkflowHref?: string;
  workspaceStarterLibraryHref?: string;
  hasScopedWorkspaceStarterFilters?: boolean;
  onSave: () => void;
  onSaveAsWorkspaceStarter: () => void;
};

export function WorkflowEditorHero({
  currentHref = null,
  workflowId,
  workflowName,
  onWorkflowNameChange,
  workflowVersion,
  nodesCount,
  edgesCount,
  toolsCount,
  availableRunsCount,
  isDirty,
  selectedNodeLabel,
  selectedEdgeId,
  workflowsCount,
  selectedRunAttached,
  plannedNodeLabels,
  unsupportedNodes,
  contractValidationIssuesCount,
  toolReferenceValidationIssuesCount,
  nodeExecutionValidationIssuesCount,
  toolExecutionValidationIssuesCount,
  publishDraftValidationIssuesCount,
  persistBlockedMessage,
  persistBlockerSummary,
  persistBlockers,
  persistBlockerRecommendedNextStep = null,
  isSaving,
  isSavingStarter,
  workflowLibraryHref = "/workflows",
  createWorkflowHref = "/workflows/new",
  workspaceStarterLibraryHref = "/workspace-starters",
  hasScopedWorkspaceStarterFilters = false,
  onSave,
  onSaveAsWorkspaceStarter
}: WorkflowEditorHeroProps) {
  const [isEditingName, setIsEditingName] = useState(false);

  const totalIssues = 
    contractValidationIssuesCount + 
    toolReferenceValidationIssuesCount + 
    nodeExecutionValidationIssuesCount + 
    toolExecutionValidationIssuesCount + 
    publishDraftValidationIssuesCount;

  return (
    <div style={{ 
      padding: '12px 24px', 
      borderBottom: '1px solid #e5e7eb', 
      background: 'white',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      zIndex: 10
    }}>
      <Space size="middle">
        {isEditingName ? (
          <Input 
            autoFocus
            defaultValue={workflowName}
            onBlur={(e) => {
              onWorkflowNameChange(e.target.value);
              setIsEditingName(false);
            }}
            onPressEnter={(e) => {
              onWorkflowNameChange(e.currentTarget.value);
              setIsEditingName(false);
            }}
            style={{ width: 200 }}
          />
        ) : (
          <Text strong style={{ fontSize: 16, cursor: 'pointer' }} onClick={() => setIsEditingName(true)}>
            {workflowName} <EditOutlined style={{ color: '#9ca3af', fontSize: 14 }} />
          </Text>
        )}
        <Tag color="blue">v{workflowVersion}</Tag>
        {isDirty && <Tag color="warning">未保存修改</Tag>}
        {totalIssues > 0 && (
          <Tooltip title={`发现 ${totalIssues} 个验证问题`}>
            <Tag icon={<WarningOutlined />} color="error">{totalIssues} 个问题</Tag>
          </Tooltip>
        )}
      </Space>

      <Space>
        {persistBlockerSummary && (
          <Text type="danger" style={{ marginRight: 16 }}>
            <WarningOutlined /> {persistBlockerSummary}
          </Text>
        )}
        <Button 
          icon={<SaveOutlined />} 
          onClick={onSaveAsWorkspaceStarter} 
          loading={isSavingStarter}
        >
          保存为模板
        </Button>
        <Button 
          type="primary" 
          icon={<SaveOutlined />} 
          onClick={onSave} 
          loading={isSaving}
          disabled={!!persistBlockerSummary}
        >
          保存
        </Button>
        <Button type="primary" style={{ background: '#10B981', borderColor: '#10B981' }} icon={<PlayCircleOutlined />}>
          运行
        </Button>
      </Space>
    </div>
  );
}
