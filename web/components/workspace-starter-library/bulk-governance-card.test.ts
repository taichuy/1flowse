import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type {
  WorkspaceStarterBulkPreview,
  WorkspaceStarterBulkActionResult,
  WorkspaceStarterTemplateItem
} from "@/lib/get-workspace-starters";

import { WorkspaceStarterBulkGovernanceCard } from "./bulk-governance-card";
import {
  buildBulkActionMessage,
  buildWorkspaceStarterBulkAffectedStarterTargets,
  buildWorkspaceStarterBulkPreviewFocusTargets,
  buildWorkspaceStarterBulkResultFocusTargets
} from "./shared";

describe("WorkspaceStarterBulkGovernanceCard", () => {
  it("renders sandbox dependency drift narrative for the latest bulk run", () => {
    const templates: WorkspaceStarterTemplateItem[] = [
      {
        id: "starter-sandbox",
        workspace_id: "default",
        name: "Sandbox starter",
        description: "",
        business_track: "编排节点能力",
        default_workflow_name: "Sandbox starter",
        workflow_focus: "",
        recommended_next_step: "",
        tags: [],
        definition: {
          nodes: [],
          edges: []
        },
        created_from_workflow_id: "wf-demo",
        created_from_workflow_version: "0.1.4",
        archived: false,
        archived_at: null,
        created_at: "2026-03-21T10:00:00Z",
        updated_at: "2026-03-21T10:00:00Z"
      }
    ];
    const lastResult: WorkspaceStarterBulkActionResult = {
      workspace_id: "default",
      action: "refresh",
      requested_count: 2,
      updated_count: 1,
      skipped_count: 1,
      updated_items: [],
      deleted_items: [],
      skipped_items: [
        {
          template_id: "starter-manual",
          name: "Manual starter",
          archived: false,
          reason: "no_source_workflow",
          detail: "Workspace starter has no source workflow.",
          source_workflow_id: null,
          source_workflow_version: null,
          action_decision: null,
          sandbox_dependency_changes: null,
          sandbox_dependency_nodes: []
        }
      ],
      skipped_reason_summary: [
        {
          reason: "no_source_workflow",
          count: 1,
          detail: "Workspace starter has no source workflow."
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
          template_id: "starter-sandbox",
          name: "Sandbox starter",
          source_workflow_id: "wf-demo",
          source_workflow_version: "0.1.5",
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
          template_id: "starter-sandbox",
          name: "Sandbox starter",
          outcome: "updated",
          archived: false,
          reason: null,
          detail: "已把 starter 快照应用到最新来源事实。",
          source_workflow_id: "wf-demo",
          source_workflow_version: "0.1.5",
          action_decision: {
            recommended_action: "refresh",
            status_label: "建议 refresh",
            summary: "当前主要是来源快照漂移。",
            can_refresh: true,
            can_rebase: true,
            fact_chips: ["source 0.1.5"]
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
          template_id: "starter-manual",
          name: "Manual starter",
          outcome: "skipped",
          archived: false,
          reason: "no_source_workflow",
          detail: "Workspace starter has no source workflow.",
          source_workflow_id: null,
          source_workflow_version: null,
          action_decision: null,
          sandbox_dependency_changes: null,
          sandbox_dependency_nodes: [],
          changed: false,
          rebase_fields: []
        }
      ]
    };
    const preview: WorkspaceStarterBulkPreview = {
      workspace_id: "default",
      requested_count: 2,
      previews: {
        archive: emptyBulkPreviewAction("archive"),
        restore: emptyBulkPreviewAction("restore"),
        refresh: {
          action: "refresh",
          candidate_count: 1,
          blocked_count: 1,
          candidate_items: [
            {
              template_id: "starter-sandbox",
              name: "Sandbox starter",
              archived: false,
              source_workflow_id: "wf-demo",
              source_workflow_version: "0.1.5",
              action_decision: {
                recommended_action: "refresh",
                status_label: "建议 refresh",
                summary: "当前主要是来源快照漂移。",
                can_refresh: true,
                can_rebase: true,
                fact_chips: ["source 0.1.5"]
              },
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
          blocked_items: [
            {
              template_id: "starter-manual",
              name: "Manual starter",
              archived: false,
              reason: "no_source_workflow",
              detail: "Workspace starter has no source workflow.",
              source_workflow_id: null,
              source_workflow_version: null,
              action_decision: null,
              sandbox_dependency_changes: null,
              sandbox_dependency_nodes: []
            }
          ],
          blocked_reason_summary: [
            {
              reason: "no_source_workflow",
              count: 1,
              detail: "Workspace starter has no source workflow."
            }
          ]
        },
        rebase: {
          action: "rebase",
          candidate_count: 1,
          blocked_count: 0,
          candidate_items: [
            {
              template_id: "starter-sandbox",
              name: "Sandbox starter",
              archived: false,
              source_workflow_id: "wf-demo",
              source_workflow_version: "0.1.5",
              action_decision: {
                recommended_action: "refresh",
                status_label: "建议 refresh",
                summary: "当前主要是来源快照漂移。",
                can_refresh: true,
                can_rebase: true,
                fact_chips: ["source 0.1.5"]
              },
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
          blocked_items: [],
          blocked_reason_summary: []
        },
        delete: emptyBulkPreviewAction("delete")
      }
    };

    const html = renderToStaticMarkup(
      createElement(WorkspaceStarterBulkGovernanceCard, {
        inScopeCount: 2,
        preview,
        previewNotice: null,
        isMutating: false,
        isLoadingPreview: false,
        lastResult,
        previewFocusTargets: buildWorkspaceStarterBulkPreviewFocusTargets(preview, templates),
        resultFocusTargets: buildWorkspaceStarterBulkResultFocusTargets(lastResult, templates),
        selectedTemplateId: "starter-sandbox",
        onFocusTemplate: () => {},
        onAction: () => {}
      })
    );

    expect(html).toContain("last run: 刷新");
    expect(html).toContain("刷新 1 · block 1");
    expect(html).toContain("刷新 preview:");
    expect(html).toContain("候选 1 个；阻塞 1 个（无来源 1）");
    expect(html).toContain("Preview focus");
    expect(html).toContain("Sandbox starter · 建议 refresh · source 0.1.5");
    expect(html).toContain("sandbox drift 1");
    expect(html).toContain("Result receipt:");
    expect(html).toContain("本次批量刷新请求 2 个 starter。 实际处理 1 个。 跳过 1 个（无来源 1）。");
    expect(html).toContain("Sandbox drift:");
    expect(html).toContain("本次批量刷新涉及 1 个 starter、1 个 sandbox 依赖漂移节点");
    expect(html).toContain("Affected starters:");
    expect(html).toContain("Sandbox starter（sandbox）");
    expect(html).toContain("无来源 1");
    expect(html).toContain("Result receipt focus");
    expect(html).toContain("Sandbox starter · 已刷新 · 建议 refresh · source 0.1.5 · sandbox · drift 1");
  });

  it("adds sandbox dependency drift summary into the bulk action message", () => {
    const message = buildBulkActionMessage({
      action: "rebase",
      updated_count: 2,
      skipped_count: 0,
      deleted_items: [],
      skipped_reason_summary: [],
      sandbox_dependency_changes: {
        template_count: 2,
        source_count: 2,
        added_count: 0,
        removed_count: 1,
        changed_count: 2
      },
      sandbox_dependency_items: [
        {
          template_id: "starter-a",
          name: "Starter A",
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
        },
        {
          template_id: "starter-b",
          name: "Starter B",
          source_workflow_id: "wf-b",
          source_workflow_version: "0.3.0",
          sandbox_dependency_changes: {
            template_count: 1,
            source_count: 1,
            added_count: 0,
            removed_count: 1,
            changed_count: 1
          },
          sandbox_dependency_nodes: ["sandbox", "auditor"]
        }
      ]
    });

    expect(message).toContain("已rebase 2 个模板");
    expect(message).toContain("涉及 2 个 starter / 3 个 sandbox 依赖漂移节点");
  });

  it("builds focus targets from bulk sandbox drift items", () => {
    const templates: WorkspaceStarterTemplateItem[] = [
      {
        id: "starter-a",
        workspace_id: "default",
        name: "Starter A",
        description: "",
        business_track: "应用新建编排",
        default_workflow_name: "Starter A",
        workflow_focus: "",
        recommended_next_step: "",
        tags: [],
        definition: {
          nodes: [],
          edges: []
        },
        created_from_workflow_id: "wf-a",
        created_from_workflow_version: "0.2.0",
        archived: false,
        archived_at: null,
        created_at: "2026-03-21T10:00:00Z",
        updated_at: "2026-03-21T10:00:00Z"
      },
      {
        id: "starter-b",
        workspace_id: "default",
        name: "Starter B",
        description: "",
        business_track: "编排节点能力",
        default_workflow_name: "Starter B",
        workflow_focus: "",
        recommended_next_step: "",
        tags: [],
        definition: {
          nodes: [],
          edges: []
        },
        created_from_workflow_id: "wf-b",
        created_from_workflow_version: "0.3.0",
        archived: true,
        archived_at: "2026-03-21T11:00:00Z",
        created_at: "2026-03-21T10:00:00Z",
        updated_at: "2026-03-21T11:00:00Z"
      }
    ];

    const targets = buildWorkspaceStarterBulkAffectedStarterTargets(
      {
        sandbox_dependency_items: [
          {
            template_id: "starter-a",
            name: "Starter A",
            source_workflow_id: "wf-a",
            source_workflow_version: "0.2.0",
            sandbox_dependency_changes: {
              template_count: 1,
              source_count: 1,
              added_count: 0,
              removed_count: 1,
              changed_count: 1
            },
            sandbox_dependency_nodes: ["sandbox", "auditor"]
          },
          {
            template_id: "starter-b",
            name: "Starter B",
            source_workflow_id: "wf-b",
            source_workflow_version: "0.3.0",
            sandbox_dependency_changes: {
              template_count: 1,
              source_count: 1,
              added_count: 0,
              removed_count: 0,
              changed_count: 1
            },
            sandbox_dependency_nodes: []
          },
          {
            template_id: "starter-a",
            name: "Starter A duplicate",
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
        ]
      },
      templates
    );

    expect(targets).toEqual([
      {
        templateId: "starter-a",
        name: "Starter A",
        sourceWorkflowVersion: "0.2.0",
        sandboxNodeSummary: "sandbox、auditor",
        driftNodeCount: 2,
        archived: false
      },
      {
        templateId: "starter-b",
        name: "Starter B",
        sourceWorkflowVersion: "0.3.0",
        sandboxNodeSummary: "未命名节点",
        driftNodeCount: 1,
        archived: true
      }
    ]);
  });
});

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
