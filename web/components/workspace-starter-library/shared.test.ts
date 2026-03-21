import { describe, expect, it } from "vitest";

import type {
  WorkspaceStarterBulkActionResult,
  WorkspaceStarterBulkPreview,
  WorkspaceStarterSourceDiff,
  WorkspaceStarterTemplateItem
} from "@/lib/get-workspace-starters";

import {
  buildWorkspaceStarterBulkPreviewFocusTargets,
  buildWorkspaceStarterBulkPreviewNarrative,
  buildWorkspaceStarterBulkResultFocusTargets,
  buildWorkspaceStarterBulkResultNarrative,
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
  it("builds backend-driven bulk preview narratives and focus targets", () => {
    const preview: WorkspaceStarterBulkPreview = {
      workspace_id: "default",
      requested_count: 3,
      previews: {
        archive: emptyBulkPreviewAction("archive"),
        restore: emptyBulkPreviewAction("restore"),
        refresh: {
          action: "refresh",
          candidate_count: 1,
          blocked_count: 2,
          candidate_items: [
            {
              template_id: "starter-active-a",
              name: "Active starter A",
              archived: false,
              source_workflow_id: "wf-a",
              source_workflow_version: "0.2.0",
              action_decision: {
                recommended_action: "refresh",
                status_label: "建议 refresh",
                summary: "当前主要是来源快照漂移。",
                can_refresh: true,
                can_rebase: true,
                fact_chips: ["source 0.2.0"]
              },
              sandbox_dependency_changes: null,
              sandbox_dependency_nodes: []
            }
          ],
          blocked_items: [
            {
              template_id: "starter-active-sandbox",
              name: "Active sandbox starter",
              archived: false,
              reason: "name_drift_only",
              detail: "当前只漂移默认 workflow 名称；refresh 不会改名，如需让 starter 命名跟随来源，请执行 rebase。",
              source_workflow_id: "wf-c",
              source_workflow_version: "0.3.0",
              action_decision: {
                recommended_action: "rebase",
                status_label: "建议 rebase",
                summary: "当前只漂移默认 workflow 名称；refresh 不会改名，如需让 starter 命名跟随来源，请执行 rebase。",
                can_refresh: false,
                can_rebase: true,
                fact_chips: ["source 0.3.0", "name drift"]
              },
              sandbox_dependency_changes: null,
              sandbox_dependency_nodes: []
            },
            {
              template_id: "starter-archived-sandbox",
              name: "Archived sandbox starter",
              archived: true,
              reason: "already_aligned",
              detail: "当前模板快照和来源 workflow 已对齐，无需 refresh 或 rebase。",
              source_workflow_id: "wf-b",
              source_workflow_version: "0.2.0",
              action_decision: {
                recommended_action: "none",
                status_label: "已对齐",
                summary: "当前模板快照和来源 workflow 已对齐，无需 refresh 或 rebase。",
                can_refresh: false,
                can_rebase: false,
                fact_chips: ["source 0.2.0"]
              },
              sandbox_dependency_changes: null,
              sandbox_dependency_nodes: []
            }
          ],
          blocked_reason_summary: [
            {
              reason: "already_aligned",
              count: 1,
              detail: "当前模板快照和来源 workflow 已对齐，无需 refresh 或 rebase。"
            },
            {
              reason: "name_drift_only",
              count: 1,
              detail: "当前只漂移默认 workflow 名称；refresh 不会改名，如需让 starter 命名跟随来源，请执行 rebase。"
            }
          ]
        },
        rebase: {
          action: "rebase",
          candidate_count: 2,
          blocked_count: 1,
          candidate_items: [
            {
              template_id: "starter-active-a",
              name: "Active starter A",
              archived: false,
              source_workflow_id: "wf-a",
              source_workflow_version: "0.2.0",
              action_decision: {
                recommended_action: "refresh",
                status_label: "建议 refresh",
                summary: "当前主要是来源快照漂移。",
                can_refresh: true,
                can_rebase: true,
                fact_chips: ["source 0.2.0"]
              },
              sandbox_dependency_changes: null,
              sandbox_dependency_nodes: []
            },
            {
              template_id: "starter-active-sandbox",
              name: "Active sandbox starter",
              archived: false,
              source_workflow_id: "wf-c",
              source_workflow_version: "0.3.0",
              action_decision: {
                recommended_action: "rebase",
                status_label: "建议 rebase",
                summary: "当前只漂移默认 workflow 名称；refresh 不会改名，如需让 starter 命名跟随来源，请执行 rebase。",
                can_refresh: false,
                can_rebase: true,
                fact_chips: ["source 0.3.0", "name drift"]
              },
              sandbox_dependency_changes: null,
              sandbox_dependency_nodes: []
            }
          ],
          blocked_items: [
            {
              template_id: "starter-archived-sandbox",
              name: "Archived sandbox starter",
              archived: true,
              reason: "already_aligned",
              detail: "当前模板快照和来源 workflow 已对齐，无需 refresh 或 rebase。",
              source_workflow_id: "wf-b",
              source_workflow_version: "0.2.0",
              action_decision: {
                recommended_action: "none",
                status_label: "已对齐",
                summary: "当前模板快照和来源 workflow 已对齐，无需 refresh 或 rebase。",
                can_refresh: false,
                can_rebase: false,
                fact_chips: ["source 0.2.0"]
              },
              sandbox_dependency_changes: null,
              sandbox_dependency_nodes: []
            }
          ],
          blocked_reason_summary: [
            {
              reason: "already_aligned",
              count: 1,
              detail: "当前模板快照和来源 workflow 已对齐，无需 refresh 或 rebase。"
            }
          ]
        },
        delete: emptyBulkPreviewAction("delete")
      }
    };

    expect(buildWorkspaceStarterBulkPreviewNarrative(preview)).toEqual([
      {
        label: "刷新 preview",
        text: "候选 1 个；阻塞 2 个（已对齐 1 / 仅名称漂移 1）"
      },
      {
        label: "rebase preview",
        text: "候选 2 个；阻塞 1 个（已对齐 1）"
      }
    ]);
    expect(buildWorkspaceStarterBulkPreviewFocusTargets(preview, templates)).toEqual([
      {
        templateId: "starter-active-a",
        name: "Active starter A",
        sourceWorkflowVersion: "0.2.0",
        statusLabel: "建议 refresh",
        archived: false
      },
      {
        templateId: "starter-active-sandbox",
        name: "Active sandbox starter",
        sourceWorkflowVersion: "0.3.0",
        statusLabel: "建议 rebase",
        archived: false
      },
      {
        templateId: "starter-archived-sandbox",
        name: "Archived sandbox starter",
        sourceWorkflowVersion: "0.2.0",
        statusLabel: "已对齐",
        archived: true
      }
    ]);
  });

  it("builds bulk result receipt narratives and focus targets", () => {
    const result: WorkspaceStarterBulkActionResult = {
      workspace_id: "default",
      action: "refresh",
      requested_count: 3,
      updated_count: 1,
      skipped_count: 2,
      updated_items: [],
      deleted_items: [],
      skipped_items: [],
      skipped_reason_summary: [
        {
          reason: "name_drift_only",
          count: 1,
          detail:
            "当前只漂移默认 workflow 名称；refresh 不会改名，如需让 starter 命名跟随来源，请执行 rebase。"
        },
        {
          reason: "not_found",
          count: 1,
          detail: "Workspace starter template not found."
        }
      ],
      sandbox_dependency_changes: {
        template_count: 1,
        source_count: 1,
        added_count: 0,
        removed_count: 0,
        changed_count: 1
      },
      sandbox_dependency_items: [
        {
          template_id: "starter-active-a",
          name: "Active starter A",
          source_workflow_id: "wf-a",
          source_workflow_version: "0.2.0",
          sandbox_dependency_changes: {
            template_count: 1,
            source_count: 1,
            added_count: 0,
            removed_count: 0,
            changed_count: 1
          },
          sandbox_dependency_nodes: ["sandbox"]
        }
      ],
      receipt_items: [
        {
          template_id: "starter-active-a",
          name: "Active starter A",
          outcome: "updated",
          archived: false,
          reason: null,
          detail: "已把 starter 快照应用到最新来源事实。",
          source_workflow_id: "wf-a",
          source_workflow_version: "0.2.0",
          action_decision: {
            recommended_action: "refresh",
            status_label: "建议 refresh",
            summary: "当前主要是来源快照漂移，建议 refresh 对齐模板快照。",
            can_refresh: true,
            can_rebase: true,
            fact_chips: ["source 0.2.0", "sandbox drift 1"]
          },
          sandbox_dependency_changes: {
            template_count: 1,
            source_count: 1,
            added_count: 0,
            removed_count: 0,
            changed_count: 1
          },
          sandbox_dependency_nodes: ["sandbox"],
          changed: true,
          rebase_fields: []
        },
        {
          template_id: "starter-active-sandbox",
          name: "Active sandbox starter",
          outcome: "skipped",
          archived: false,
          reason: "name_drift_only",
          detail:
            "当前只漂移默认 workflow 名称；refresh 不会改名，如需让 starter 命名跟随来源，请执行 rebase。",
          source_workflow_id: "wf-c",
          source_workflow_version: "0.3.0",
          action_decision: {
            recommended_action: "rebase",
            status_label: "建议 rebase",
            summary:
              "当前只漂移默认 workflow 名称；refresh 不会改名，如需让 starter 命名跟随来源，请执行 rebase。",
            can_refresh: false,
            can_rebase: true,
            fact_chips: ["name drift", "rebase 1"]
          },
          sandbox_dependency_changes: null,
          sandbox_dependency_nodes: [],
          changed: false,
          rebase_fields: []
        },
        {
          template_id: "missing-template",
          name: "Missing starter",
          outcome: "skipped",
          archived: false,
          reason: "not_found",
          detail: "Workspace starter template not found.",
          source_workflow_id: null,
          source_workflow_version: null,
          action_decision: null,
          sandbox_dependency_changes: null,
          sandbox_dependency_nodes: [],
          changed: false,
          rebase_fields: []
        }
      ],
      outcome_explanation: {
        primary_signal:
          "本次批量刷新请求 3 个 starter；实际处理 1 个。 结果回执里还有 2 个跳过项（仅名称漂移 1 / 不存在 1）。 其中 1 个 starter / 1 个 sandbox 依赖漂移节点已沉淀进同一份 result receipt。",
        follow_up:
          "优先对标记为“仅名称漂移”的 starter 执行 rebase，让命名与来源 workflow 保持一致。 优先复核 result receipt 中带 sandbox drift 的 starter，确认依赖节点与隔离策略是否仍符合预期。"
      },
      follow_up_template_ids: ["starter-active-sandbox", "starter-active-a"]
    };

    expect(buildWorkspaceStarterBulkResultNarrative(result)).toEqual([
      {
        label: "Result receipt",
        text: "本次批量刷新请求 3 个 starter。 实际处理 1 个。 跳过 2 个（仅名称漂移 1 / 不存在 1）。"
      },
      {
        label: "Sandbox drift",
        text: "本次批量刷新涉及 1 个 starter、1 个 sandbox 依赖漂移节点；新增 0 / 移除 0 / 变更 1"
      },
      {
        label: "Affected starters",
        text: "Active starter A（sandbox）"
      }
    ]);
    expect(buildWorkspaceStarterBulkResultFocusTargets(result, templates)).toEqual([
      {
        templateId: "starter-active-sandbox",
        name: "Active sandbox starter",
        sourceWorkflowVersion: "0.3.0",
        statusLabel: "仅名称漂移",
        detail:
          "当前只漂移默认 workflow 名称；refresh 不会改名，如需让 starter 命名跟随来源，请执行 rebase。",
        sandboxNodeSummary: null,
        driftNodeCount: 0,
        archived: false
      },
      {
        templateId: "starter-active-a",
        name: "Active starter A",
        sourceWorkflowVersion: "0.2.0",
        statusLabel: "已刷新 · 建议 refresh",
        detail: "已把 starter 快照应用到最新来源事实。",
        sandboxNodeSummary: "sandbox",
        driftNodeCount: 1,
        archived: false
      }
    ]);
  });

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
      action_decision: {
        recommended_action: "rebase",
        status_label: "建议 rebase",
        summary:
          "当前只漂移默认 workflow 名称；refresh 不会改名，如需让 starter 命名跟随来源，请执行 rebase。",
        can_refresh: false,
        can_rebase: true,
        fact_chips: ["template 0.1.0", "source 0.1.0", "name drift", "rebase 1"]
      },
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
      action_decision: {
        recommended_action: "refresh",
        status_label: "建议 refresh",
        summary:
          "当前主要是 sandbox 依赖治理漂移。优先 refresh 同步最新 definition / version，并重点复核 dependencyMode、builtinPackageSet、dependencyRef 与 backendExtensions。",
        can_refresh: true,
        can_rebase: true,
        fact_chips: [
          "template 0.1.0",
          "source 0.2.0",
          "structure drift 1",
          "sandbox drift 1",
          "rebase 2"
        ]
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
      action_decision: {
        recommended_action: "none",
        status_label: "已对齐",
        summary: "当前模板快照和来源 workflow 已对齐，无需 refresh 或 rebase。",
        can_refresh: false,
        can_rebase: false,
        fact_chips: ["template 0.2.0", "source 0.2.0"]
      },
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

function emptyBulkPreviewAction(
  action: "archive" | "restore" | "refresh" | "rebase" | "delete"
): WorkspaceStarterBulkPreview["previews"]["archive"] {
  return {
    action,
    candidate_count: 0,
    blocked_count: 0,
    candidate_items: [],
    blocked_items: [],
    blocked_reason_summary: []
  };
}
