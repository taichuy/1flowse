import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { WorkflowEditorHero } from "@/components/workflow-editor-workbench/workflow-editor-hero";

describe("WorkflowEditorHero", () => {
  it("shows the shared save gate summary and blocker chips", () => {
    const html = renderToStaticMarkup(
      createElement(WorkflowEditorHero, {
        workflowId: "workflow-1",
        workflowVersion: "1.0.0",
        nodesCount: 4,
        edgesCount: 3,
        toolsCount: 2,
        availableRunsCount: 1,
        isDirty: true,
        selectedNodeLabel: null,
        selectedEdgeId: null,
        workflowsCount: 1,
        selectedRunAttached: false,
        plannedNodeLabels: [],
        unsupportedNodes: [],
        contractValidationIssuesCount: 0,
        toolReferenceValidationIssuesCount: 0,
        nodeExecutionValidationIssuesCount: 0,
        toolExecutionValidationIssuesCount: 2,
        publishDraftValidationIssuesCount: 1,
        persistBlockedMessage: "blocked",
        persistBlockerSummary:
          "当前保存会被 2 类问题阻断：Execution capability / Publish draft。",
        persistBlockers: [
          {
            id: "tool_execution",
            label: "Execution capability",
            detail: "execution detail",
            nextStep: "execution next step"
          },
          {
            id: "publish_draft",
            label: "Publish draft",
            detail: "publish detail",
            nextStep: "publish next step"
          }
        ],
        isSaving: false,
        isSavingStarter: false,
        onSave: () => undefined,
        onSaveAsWorkspaceStarter: () => undefined
      })
    );

    expect(html).toContain("当前保存会被 2 类问题阻断");
    expect(html).toContain("Execution capability");
    expect(html).toContain("Publish draft");
  });
});
