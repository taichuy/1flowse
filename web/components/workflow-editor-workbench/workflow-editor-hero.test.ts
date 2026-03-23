import * as React from "react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import { WorkflowEditorHero } from "@/components/workflow-editor-workbench/workflow-editor-hero";
import { buildWorkflowEditorHeroSurfaceCopy } from "@/lib/workbench-entry-surfaces";

Object.assign(globalThis, { React });

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: { children: ReactNode; href?: string } & Record<string, unknown>) =>
    createElement("a", { href: href ?? "#", ...props }, children)
}));

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
        persistBlockerRecommendedNextStep: {
          label: "sandbox readiness",
          detail:
            "当前 live sandbox readiness 仍影响 4 个 run / 1 个 workflow；优先回到 workflow library 处理强隔离 execution class 与隔离需求。",
          href: "/workflows?execution=sandbox",
          href_label: "Open workflow library"
        },
        isSaving: false,
        isSavingStarter: false,
        onSave: () => undefined,
        onSaveAsWorkspaceStarter: () => undefined
      })
    );

    expect(html).toContain("当前保存会被 2 类问题阻断");
    expect(html).toContain("Execution capability");
    expect(html).toContain("Publish draft");
    expect(html).toContain("Recommended next step");
    expect(html).toContain("Open workflow library");
  });

  it("keeps workspace starter governance scope in editor actions", () => {
    const surfaceCopy = buildWorkflowEditorHeroSurfaceCopy({
      createWorkflowHref:
        "/workflows/new?needs_follow_up=true&q=drift&source_governance_kind=drifted&starter=workspace-starter-1&track=%E5%BA%94%E7%94%A8%E6%96%B0%E5%BB%BA%E7%BC%96%E6%8E%92",
      workspaceStarterLibraryHref:
        "/workspace-starters?needs_follow_up=true&q=drift&source_governance_kind=drifted&starter=workspace-starter-1&track=%E5%BA%94%E7%94%A8%E6%96%B0%E5%BB%BA%E7%BC%96%E6%8E%92",
      plannedNodeSummary: null
    });
    const html = renderToStaticMarkup(
      createElement(WorkflowEditorHero, {
        workflowId: "workflow-1",
        workflowVersion: "1.0.0",
        nodesCount: 4,
        edgesCount: 3,
        toolsCount: 2,
        availableRunsCount: 1,
        isDirty: false,
        selectedNodeLabel: null,
        selectedEdgeId: null,
        workflowsCount: 1,
        selectedRunAttached: false,
        plannedNodeLabels: [],
        unsupportedNodes: [],
        contractValidationIssuesCount: 0,
        toolReferenceValidationIssuesCount: 0,
        nodeExecutionValidationIssuesCount: 0,
        toolExecutionValidationIssuesCount: 0,
        publishDraftValidationIssuesCount: 0,
        persistBlockedMessage: null,
        persistBlockerSummary: null,
        persistBlockers: [],
        isSaving: false,
        isSavingStarter: false,
        createWorkflowHref:
          "/workflows/new?needs_follow_up=true&q=drift&source_governance_kind=drifted&starter=workspace-starter-1&track=%E5%BA%94%E7%94%A8%E6%96%B0%E5%BB%BA%E7%BC%96%E6%8E%92",
        workspaceStarterLibraryHref:
          "/workspace-starters?needs_follow_up=true&q=drift&source_governance_kind=drifted&starter=workspace-starter-1&track=%E5%BA%94%E7%94%A8%E6%96%B0%E5%BB%BA%E7%BC%96%E6%8E%92",
        hasScopedWorkspaceStarterFilters: true,
        onSave: () => undefined,
        onSaveAsWorkspaceStarter: () => undefined
      })
    );

    expect(html).toContain(surfaceCopy.scopedGovernancePrefix);
    expect(html).toContain(surfaceCopy.scopedGovernanceBackLinkLabel);
    expect(html).toContain(surfaceCopy.scopedGovernanceCreateWorkflowLabel);
    expect(html).toContain('/workflows');
    expect(html).toContain(
      "/workspace-starters?needs_follow_up=true&amp;q=drift&amp;source_governance_kind=drifted&amp;starter=workspace-starter-1&amp;track=%E5%BA%94%E7%94%A8%E6%96%B0%E5%BB%BA%E7%BC%96%E6%8E%92"
    );
    expect(html).toContain(
      "/workflows/new?needs_follow_up=true&amp;q=drift&amp;source_governance_kind=drifted&amp;starter=workspace-starter-1&amp;track=%E5%BA%94%E7%94%A8%E6%96%B0%E5%BB%BA%E7%BC%96%E6%8E%92"
    );
  });
});
