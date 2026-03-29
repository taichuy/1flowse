import { describe, expect, it } from "vitest";

import {
  resolveWorkflowCreateNameAfterStarterChange,
  resolveWorkflowCreateSelectedStarter
} from "@/components/workflow-create-wizard/use-workflow-create-shell-state";
import type { WorkflowStarterTemplate } from "@/lib/workflow-starters";

const blankStarter: WorkflowStarterTemplate = {
  id: "starter-blank",
  origin: "workspace",
  name: "Blank Flow",
  description: "Minimal starter",
  businessTrack: "应用新建编排",
  priority: "P0",
  trackSummary: "从空白应用开始",
  trackFocus: "创建应用",
  defaultWorkflowName: "Blank Flow",
  source: {
    kind: "starter",
    scope: "workspace",
    status: "available",
    governance: "workspace",
    ecosystem: "7flows",
    label: "Workspace starter",
    shortLabel: "workspace",
    summary: "Workspace maintained"
  },
  createdFromWorkflowId: null,
  workflowFocus: "Create blank app",
  recommendedNextStep: "进入 Studio",
  nodeCount: 2,
  nodeLabels: ["Trigger", "Output"],
  referencedTools: [],
  missingToolIds: [],
  governedToolCount: 0,
  strongIsolationToolCount: 0,
  sandboxGovernance: {
    sandboxNodeCount: 0,
    explicitExecutionCount: 0,
    executionClasses: [],
    dependencyModes: [],
    dependencyModeCounts: {},
    builtinPackageSets: [],
    dependencyRefs: [],
    backendExtensionNodeCount: 0,
    backendExtensionKeys: [],
    nodes: []
  },
  sourceGovernance: null,
  archived: false,
  tags: [],
  definition: {
    nodes: [],
    edges: [],
    variables: [],
    publish: []
  }
};

const agentStarter: WorkflowStarterTemplate = {
  ...blankStarter,
  id: "starter-agent",
  name: "Agent App",
  businessTrack: "编排节点能力",
  defaultWorkflowName: "Agent App"
};

describe("use-workflow-create-shell-state helpers", () => {
  it("falls back to the provided starter when the selected id is missing", () => {
    expect(
      resolveWorkflowCreateSelectedStarter({
        selectedStarterId: "missing-id",
        starterTemplates: [blankStarter, agentStarter],
        fallbackStarter: blankStarter
      })
    ).toBe(blankStarter);
  });

  it("rewrites the draft name only when the current name is empty or still default", () => {
    expect(
      resolveWorkflowCreateNameAfterStarterChange({
        currentStarter: blankStarter,
        nextStarter: agentStarter,
        workflowName: "Blank Flow"
      })
    ).toBe("Agent App");

    expect(
      resolveWorkflowCreateNameAfterStarterChange({
        currentStarter: blankStarter,
        nextStarter: agentStarter,
        workflowName: "Customer Support Bot"
      })
    ).toBe("Customer Support Bot");
  });
});
