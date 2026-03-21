import { describe, expect, it } from "vitest";

import type {
  WorkspaceStarterSourceDiff,
  WorkspaceStarterTemplateItem
} from "@/lib/get-workspace-starters";

import {
  buildWorkspaceStarterSourceActionDecision,
  buildWorkspaceStarterLibrarySearchParams,
  resolveWorkspaceStarterLibraryViewState
} from "./shared";

const templates: WorkspaceStarterTemplateItem[] = [
  {
    id: "starter-active-a",
    workspace_id: "default",
    name: "Active starter A",
    description: "active template",
    business_track: "应用新建编排",
    default_workflow_name: "Starter A",
    workflow_focus: "entry flow",
    recommended_next_step: "",
    tags: ["entry"],
    definition: {
      nodes: [],
      edges: []
    },
    created_from_workflow_id: "wf-a",
    created_from_workflow_version: "0.1.0",
    archived: false,
    archived_at: null,
    created_at: "2026-03-21T10:00:00Z",
    updated_at: "2026-03-21T10:00:00Z"
  },
  {
    id: "starter-archived-sandbox",
    workspace_id: "default",
    name: "Archived sandbox starter",
    description: "sandbox template",
    business_track: "编排节点能力",
    default_workflow_name: "Sandbox starter",
    workflow_focus: "sandbox authoring",
    recommended_next_step: "",
    tags: ["sandbox"],
    definition: {
      nodes: [],
      edges: []
    },
    created_from_workflow_id: "wf-b",
    created_from_workflow_version: "0.2.0",
    archived: true,
    archived_at: "2026-03-21T12:00:00Z",
    created_at: "2026-03-21T10:00:00Z",
    updated_at: "2026-03-21T12:00:00Z"
  },
  {
    id: "starter-active-sandbox",
    workspace_id: "default",
    name: "Active sandbox starter",
    description: "sandbox template",
    business_track: "编排节点能力",
    default_workflow_name: "Sandbox starter active",
    workflow_focus: "sandbox authoring",
    recommended_next_step: "",
    tags: ["sandbox"],
    definition: {
      nodes: [],
      edges: []
    },
    created_from_workflow_id: "wf-c",
    created_from_workflow_version: "0.3.0",
    archived: false,
    archived_at: null,
    created_at: "2026-03-21T10:00:00Z",
    updated_at: "2026-03-21T12:00:00Z"
  }
];

describe("workspace starter library URL state", () => {
  it("restores focused starter from coherent query filters", () => {
    const viewState = resolveWorkspaceStarterLibraryViewState(
      {
        track: "编排节点能力",
        archive: "archived",
        q: " sandbox ",
        starter: "starter-archived-sandbox"
      },
      templates
    );

    expect(viewState).toEqual({
      activeTrack: "编排节点能力",
      archiveFilter: "archived",
      searchQuery: "sandbox",
      selectedTemplateId: "starter-archived-sandbox"
    });
  });

  it("falls back to the first filtered starter when requested focus is stale", () => {
    const viewState = resolveWorkspaceStarterLibraryViewState(
      {
        track: "编排节点能力",
        archive: "active",
        starter: "missing-starter"
      },
      templates
    );

    expect(viewState.selectedTemplateId).toBe("starter-active-sandbox");
    expect(viewState.activeTrack).toBe("编排节点能力");
    expect(viewState.archiveFilter).toBe("active");
  });

  it("serializes only non-default filters while keeping the selected starter", () => {
    const searchParams = buildWorkspaceStarterLibrarySearchParams({
      activeTrack: "编排节点能力",
      archiveFilter: "archived",
      searchQuery: " sandbox ",
      selectedTemplateId: "starter-archived-sandbox"
    });

    expect(searchParams.get("track")).toBe("编排节点能力");
    expect(searchParams.get("archive")).toBe("archived");
    expect(searchParams.get("q")).toBe("sandbox");
    expect(searchParams.get("starter")).toBe("starter-archived-sandbox");
  });
});

describe("workspace starter source action decision", () => {
  it("recommends rebase when workflow name drift is the only remaining change", () => {
    const decision = buildWorkspaceStarterSourceActionDecision({
      template_id: "starter-a",
      workspace_id: "default",
      source_workflow_id: "wf-a",
      source_workflow_name: "Sandbox authoring v2",
      template_version: "0.1.0",
      source_version: "0.1.0",
      template_default_workflow_name: "Sandbox authoring",
      source_default_workflow_name: "Sandbox authoring v2",
      workflow_name_changed: true,
      changed: true,
      rebase_fields: ["default_workflow_name"],
      node_summary: emptyDiffSummary(),
      edge_summary: emptyDiffSummary(),
      sandbox_dependency_summary: emptyDiffSummary(),
      node_entries: [],
      edge_entries: [],
      sandbox_dependency_entries: []
    });

    expect(decision.recommendedAction).toBe("rebase");
    expect(decision.canRefresh).toBe(false);
    expect(decision.canRebase).toBe(true);
    expect(decision.summary).toContain("refresh 不会改名");
  });

  it("recommends refresh when snapshot drift does not require renaming", () => {
    const decision = buildWorkspaceStarterSourceActionDecision({
      template_id: "starter-a",
      workspace_id: "default",
      source_workflow_id: "wf-a",
      source_workflow_name: "Sandbox authoring",
      template_version: "0.1.0",
      source_version: "0.2.0",
      template_default_workflow_name: "Sandbox authoring",
      source_default_workflow_name: "Sandbox authoring",
      workflow_name_changed: false,
      changed: true,
      rebase_fields: ["definition", "created_from_workflow_version"],
      node_summary: {
        template_count: 1,
        source_count: 1,
        added_count: 0,
        removed_count: 0,
        changed_count: 1
      },
      edge_summary: emptyDiffSummary(),
      sandbox_dependency_summary: {
        template_count: 1,
        source_count: 1,
        added_count: 0,
        removed_count: 1,
        changed_count: 0
      },
      node_entries: [],
      edge_entries: [],
      sandbox_dependency_entries: []
    });

    expect(decision.recommendedAction).toBe("refresh");
    expect(decision.canRefresh).toBe(true);
    expect(decision.canRebase).toBe(true);
    expect(decision.summary).toContain("优先 refresh");
    expect(decision.factChips).toContain("sandbox drift 1");
  });

  it("marks synced templates as no-op", () => {
    const decision = buildWorkspaceStarterSourceActionDecision({
      template_id: "starter-a",
      workspace_id: "default",
      source_workflow_id: "wf-a",
      source_workflow_name: "Sandbox authoring",
      template_version: "0.2.0",
      source_version: "0.2.0",
      template_default_workflow_name: "Sandbox authoring",
      source_default_workflow_name: "Sandbox authoring",
      workflow_name_changed: false,
      changed: false,
      rebase_fields: [],
      node_summary: emptyDiffSummary(),
      edge_summary: emptyDiffSummary(),
      sandbox_dependency_summary: emptyDiffSummary(),
      node_entries: [],
      edge_entries: [],
      sandbox_dependency_entries: []
    });

    expect(decision.recommendedAction).toBe("none");
    expect(decision.statusLabel).toBe("已对齐");
    expect(decision.summary).toContain("无需 refresh 或 rebase");
  });
});

function emptyDiffSummary(): WorkspaceStarterSourceDiff["node_summary"] {
  return {
    template_count: 0,
    source_count: 0,
    added_count: 0,
    removed_count: 0,
    changed_count: 0
  };
}
