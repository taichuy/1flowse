import * as React from "react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import { WorkflowCreateWizardEntry } from "@/components/workflow-create-wizard-entry";
import type { WorkflowCreateWizardProps } from "@/components/workflow-create-wizard/types";

Object.assign(globalThis, { React });

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    ...props
  }: { children: ReactNode; href?: string } & Record<string, unknown>) =>
    createElement("a", { href: href ?? "#", ...props }, children)
}));

const bootstrapData: WorkflowCreateWizardProps = {
  catalogToolCount: 2,
  governanceQueryScope: {
    activeTrack: "all",
    sourceGovernanceKind: "all",
    needsFollowUp: false,
    searchQuery: "",
    selectedTemplateId: null
  },
  workflows: [
    {
      id: "workflow-1",
      name: "Draft Workflow",
      status: "draft",
      version: "0.1.0",
      node_count: 2,
      tool_governance: {
        referenced_tool_ids: [],
        missing_tool_ids: [],
        governed_tool_count: 0,
        strong_isolation_tool_count: 0
      }
    }
  ] as WorkflowCreateWizardProps["workflows"],
  starters: [
    {
      id: "starter-1",
      origin: "workspace",
      workspaceId: "default",
      name: "Workspace starter",
      description: "Starter description",
      businessTrack: "应用新建编排",
      defaultWorkflowName: "Draft Workflow",
      workflowFocus: "Keep create facts visible before interactive controls mount.",
      recommendedNextStep: "Create workflow",
      tags: ["workspace"],
      definition: {
        nodes: [
          { id: "startNode", type: "startNode", name: "startNode", config: {} },
          { id: "llm", type: "llmAgentNode", name: "LLM Agent", config: {} }
        ],
        edges: [],
        variables: [],
        publish: []
      },
      source: {
        kind: "starter",
        scope: "workspace",
        status: "available",
        governance: "workspace",
        ecosystem: "native",
        label: "Workspace starters",
        shortLabel: "workspace ready",
        summary: "Workspace starter library"
      },
      archived: false,
      sourceGovernance: null,
      nodeCount: 2,
      nodeTypes: ["startNode", "llmAgentNode"]
    }
  ] as WorkflowCreateWizardProps["starters"],
  starterSourceLanes: [],
  nodeCatalog: [
    {
      type: "startNode",
      label: "startNode",
      description: "Trigger node",
      ecosystem: "native",
      source: {
        kind: "node",
        scope: "builtin",
        status: "available",
        governance: "repo",
        ecosystem: "native",
        label: "Native node catalog",
        shortLabel: "native nodes",
        summary: "Native nodes"
      },
      capabilityGroup: "entry",
      businessTrack: "应用新建编排",
      tags: [],
      supportStatus: "available",
      supportSummary: "",
      bindingRequired: false,
      bindingSourceLanes: [],
      palette: { enabled: true, order: 0, defaultPosition: { x: 0, y: 0 } },
      defaults: { name: "startNode", config: {} }
    },
    {
      type: "llmAgentNode",
      label: "LLM Agent",
      description: "LLM Agent node",
      ecosystem: "native",
      source: {
        kind: "node",
        scope: "builtin",
        status: "available",
        governance: "repo",
        ecosystem: "native",
        label: "Native node catalog",
        shortLabel: "native nodes",
        summary: "Native nodes"
      },
      capabilityGroup: "reasoning",
      businessTrack: "应用新建编排",
      tags: [],
      supportStatus: "available",
      supportSummary: "",
      bindingRequired: false,
      bindingSourceLanes: [],
      palette: { enabled: true, order: 1, defaultPosition: { x: 0, y: 0 } },
      defaults: { name: "LLM Agent", config: {} }
    }
  ] as WorkflowCreateWizardProps["nodeCatalog"],
  tools: []
};

function renderEntry(overrides: Partial<Parameters<typeof WorkflowCreateWizardEntry>[0]> = {}) {
  return renderToStaticMarkup(
    createElement(WorkflowCreateWizardEntry, {
      bootstrapRequest: {
        governanceQueryScope: bootstrapData.governanceQueryScope,
        includeLegacyAuthGovernanceSnapshot: false,
        libraryQuery: {
          includeBuiltinStarters: true,
          includeStarterDefinitions: true,
          needsFollowUp: false
        }
      },
      ...overrides
    })
  );
}

describe("WorkflowCreateWizardEntry", () => {
  it("renders a first-screen shell on the server when bootstrap data is already available", () => {
    const html = renderEntry({ initialBootstrapData: bootstrapData });

    expect(html).toContain('data-component="workflow-create-wizard-entry"');
    expect(html).toContain('data-has-initial-bootstrap="true"');
    expect(html).toContain('data-has-first-screen-shell="true"');
    expect(html).toContain('data-component="workflow-create-first-screen-shell"');
    expect(html).toContain("workflow create 首屏壳层");
    expect(html).toContain("Workspace starter");
    expect(html).not.toContain('data-component="authoring-surface-loading-state"');
  });

  it("keeps the generic bootstrap loading state when server bootstrap data is absent", () => {
    const html = renderEntry();

    expect(html).toContain('data-component="workflow-create-wizard-entry"');
    expect(html).toContain('data-has-initial-bootstrap="false"');
    expect(html).toContain('data-has-first-screen-shell="false"');
    expect(html).toContain('data-component="authoring-surface-loading-state"');
    expect(html).toContain("正在准备创建工作台");
    expect(html).not.toContain('data-component="workflow-create-first-screen-shell"');
  });
});
