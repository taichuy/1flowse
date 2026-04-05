import { redirect } from "next/navigation";

import {
  buildWorkflowCreateWizardBootstrapRequest,
  loadWorkflowCreateWizardBootstrap
} from "@/components/workflow-create-wizard/bootstrap";
import { WorkspaceAppsWorkbench } from "@/components/workspace-apps-workbench";
import { WorkspaceShell } from "@/components/workspace-shell";
import { getSystemOverview } from "@/lib/get-system-overview";
import { WORKSPACE_TEAM_SETTINGS_HREF } from "@/lib/workspace-console";
import {
  getWorkspaceAppModeMeta,
  inferWorkspaceAppMode,
  listWorkspaceAppModes,
  type WorkspaceAppModeId
} from "@/lib/workspace-app-modes";
import { buildWorkflowCreateHrefFromWorkspaceStarterViewState } from "@/lib/workspace-starter-governance-query";
import { getWorkflowBusinessTrack } from "@/lib/workflow-business-tracks";
import { inferWorkflowBusinessTrack } from "@/lib/workflow-starters";
import { getServerWorkspaceContext } from "@/lib/server-workspace-access";
import { formatWorkspaceRole } from "@/lib/workspace-access";
import {
  buildWorkspaceAppHref,
  buildWorkspaceAppSearchFormState,
  readWorkspaceAppViewState,
  type WorkspaceFilterKey
} from "@/lib/workspace-app-query-state";

type WorkspacePageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

type WorkspaceAppCard = {
  id: string;
  name: string;
  href: string;
  status: string;
  healthLabel: string;
  mode: ReturnType<typeof getWorkspaceAppModeMeta>;
  recommendedNextStep: string;
  track: ReturnType<typeof getWorkflowBusinessTrack>;
  nodeCount: number;
  publishCount: number;
  updatedAt: string;
  missingToolCount: number;
  followUpCount: number;
};

function getPreferredWorkspaceCreateStarterId(activeMode: WorkspaceAppModeId) {
  switch (activeMode) {
    case "chatflow":
      return "blank";
    case "agent":
      return "agent";
    case "tool_agent":
      return "tooling";
    case "sandbox":
      return "sandbox-code";
    default:
      return null;
  }
}

export default async function WorkspacePage({ searchParams }: WorkspacePageProps) {
  const workspaceContext = await getServerWorkspaceContext();
  if (!workspaceContext) {
    redirect("/login?next=/workspace");
  }

  const resolvedSearchParams = (await searchParams) ?? {};
  const { activeFilter, activeMode, activeTrack, keyword: requestedKeyword } =
    readWorkspaceAppViewState(resolvedSearchParams);
  const normalizedKeyword = requestedKeyword.toLowerCase();
  const workspaceCreateQueryScope = {
    activeTrack,
    sourceGovernanceKind: "all" as const,
    needsFollowUp: false,
    searchQuery: "",
    selectedTemplateId: getPreferredWorkspaceCreateStarterId(activeMode)
  };
  const workflowCreateBootstrapRequest = buildWorkflowCreateWizardBootstrapRequest(
    workspaceCreateQueryScope
  );

  const [workflowCreateWizardProps, systemOverview] = await Promise.all([
    loadWorkflowCreateWizardBootstrap(workflowCreateBootstrapRequest),
    getSystemOverview()
  ]);
  const appCards: WorkspaceAppCard[] = workflowCreateWizardProps.workflows
    .map((workflow) => {
    const mode = getWorkspaceAppModeMeta(
      inferWorkspaceAppMode({
        nodeTypes: workflow.node_types ?? []
      })
    );
    const track = getWorkflowBusinessTrack(
      inferWorkflowBusinessTrack({
        nodeTypes: workflow.node_types ?? [],
        publishCount: workflow.publish_count ?? 0
      })
    );
    const missingToolCount = workflow.tool_governance.missing_tool_ids.length;
    const followUpCount = missingToolCount + (workflow.definition_issues?.length ?? 0);
    const healthLabel =
      followUpCount > 0
        ? `${followUpCount} 个治理待办`
        : workflow.status === "published"
          ? "可调用"
          : "草稿可继续编排";

      return {
        id: workflow.id,
        name: workflow.name,
        href: `/workflows/${encodeURIComponent(workflow.id)}`,
        status: workflow.status,
        healthLabel,
        mode,
        recommendedNextStep:
          missingToolCount > 0
            ? `先补齐 ${missingToolCount} 个工具缺口，再进入 xyflow 继续编排。`
            : workflow.status === "published"
              ? "继续在 xyflow 维护版本，必要时从运行诊断核对线上调用。"
              : "继续在 xyflow 完成节点配置、上下文授权和发布准备。",
        track,
        nodeCount: workflow.node_count,
        publishCount: workflow.publish_count ?? 0,
        updatedAt: workflow.updated_at ?? new Date(0).toISOString(),
        missingToolCount,
        followUpCount
      };
    })
    .sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt));

  const filteredApps = appCards.filter((card) => {
    const matchesMode = activeMode === "all" || card.mode.id === activeMode;
    const matchesStatus =
      activeFilter === "draft"
        ? card.status !== "published"
        : activeFilter === "published"
          ? card.status === "published"
          : activeFilter === "follow_up"
            ? card.followUpCount > 0
            : true;

    const matchesTrack = activeTrack === "all" || card.track.id === activeTrack;
    const matchesKeyword =
      !normalizedKeyword ||
      [card.name, card.mode.label, card.track.id, card.track.summary, card.track.focus].some((value) =>
        value.toLowerCase().includes(normalizedKeyword)
      );

    return matchesMode && matchesStatus && matchesTrack && matchesKeyword;
  });

  const filterItems = [
    { key: "all", label: `全部 ${appCards.length}` },
    {
      key: "draft",
      label: `草稿 ${appCards.filter((card) => card.status !== "published").length}`
    },
    {
      key: "published",
      label: `已发布 ${appCards.filter((card) => card.status === "published").length}`
    },
    {
      key: "follow_up",
      label: `待治理 ${appCards.filter((card) => card.followUpCount > 0).length}`
    }
  ];
  const modeItems = [
    {
      key: "all" as WorkspaceAppModeId,
      label: "全部",
      count: appCards.length,
      description: "先按应用类型收敛入口，再进入 Studio。"
    },
    ...listWorkspaceAppModes().map((mode) => ({
      key: mode.id,
      label: mode.label,
      count: appCards.filter((card) => card.mode.id === mode.id).length,
      description: mode.description
    }))
  ];
  const activeModeMeta = activeMode === "all" ? null : getWorkspaceAppModeMeta(activeMode);
  const workspaceSignals = [
    { label: "应用", value: String(appCards.length) },
    {
      label: "草稿",
      value: String(appCards.filter((card) => card.status !== "published").length)
    },
    {
      label: "已发布",
      value: String(appCards.filter((card) => card.status === "published").length)
    },
    {
      label: "待治理",
      value: String(appCards.filter((card) => card.followUpCount > 0).length)
    },
    {
      label: "Sandbox",
      value: systemOverview.sandbox_readiness.primary_blocker_kind ? "需处理" : "正常"
    }
  ];
  const visibleAppSummary =
    activeMode !== "all"
      ? `${activeModeMeta?.label ?? "应用"} ${filteredApps.length} 个`
      : filteredApps.length === appCards.length
      ? `全部 ${filteredApps.length} 个应用`
      : `筛选结果 ${filteredApps.length} / ${appCards.length}`;
  const focusedCreateHref = buildWorkflowCreateHrefFromWorkspaceStarterViewState(
    workflowCreateBootstrapRequest.governanceQueryScope
  );
  const workspaceUtilityEntry = workspaceContext.can_manage_members
    ? {
        title: "管理成员与权限",
        detail: "管理员可直接开通成员账号并调整角色。",
        href: WORKSPACE_TEAM_SETTINGS_HREF,
        badge: `${workspaceContext.available_roles.length} 种角色`
      }
    : {
        title: "查看运行诊断",
        detail: "没有成员管理权限时，先从 runs 追踪运行状态。",
        href: "/runs",
        badge: `${systemOverview.runtime_activity.summary.recent_run_count} 条运行`
      };

  const modeTabs = modeItems.map((modeItem) => ({
    ...modeItem,
    active: modeItem.key === activeMode,
    href: buildWorkspaceAppHref({
      activeFilter,
      activeMode: modeItem.key,
      activeTrack,
      keyword: requestedKeyword
    })
  }));
  const statusFilters = filterItems.map((filterItem) => ({
    ...filterItem,
    active: filterItem.key === activeFilter,
    href: buildWorkspaceAppHref({
      activeFilter: filterItem.key as WorkspaceFilterKey,
      activeMode,
      activeTrack,
      keyword: requestedKeyword
    })
  }));
  const searchState = buildWorkspaceAppSearchFormState({
    activeFilter,
    activeMode,
    activeTrack,
    keyword: requestedKeyword
  });
  const activeTrackMeta = activeTrack === "all" ? null : getWorkflowBusinessTrack(activeTrack);
  const scopePills = [
    ...(activeTrackMeta
      ? [
          {
            key: "track",
            label: "业务焦点",
            value: `${activeTrackMeta.priority} ${activeTrack}`,
            href: buildWorkspaceAppHref({
              activeFilter,
              activeMode,
              keyword: requestedKeyword
            })
          }
        ]
      : []),
    ...(requestedKeyword
      ? [
          {
            key: "keyword",
            label: "关键词",
            value: requestedKeyword,
            href: buildWorkspaceAppHref({
              activeFilter,
              activeMode,
              activeTrack
            })
          }
        ]
      : [])
  ];
  const currentRoleLabel = formatWorkspaceRole(workspaceContext.current_member.role);
  const activeModeDescription =
    activeMode === "all"
      ? "先筛选应用，再进入 Studio。"
      : activeModeMeta?.description ?? "当前应用入口会继续回到 xyflow 事实源。";

  return (
    <WorkspaceShell
      activeNav="workspace"
      userName={workspaceContext.current_user.display_name}
      userRole={workspaceContext.current_member.role}
      workspaceName={workspaceContext.workspace.name}
    >
      <WorkspaceAppsWorkbench
        activeModeDescription={activeModeDescription}
        activeModeLabel={activeModeMeta?.label ?? null}
        currentRoleLabel={currentRoleLabel}
        currentUserDisplayName={workspaceContext.current_user.display_name}
        filteredApps={filteredApps}
        focusedCreateHref={focusedCreateHref}
        modeTabs={modeTabs}
        requestedKeyword={requestedKeyword}
        searchState={searchState}
        scopePills={scopePills}
        starterCount={workflowCreateWizardProps.starters.length}
        statusFilters={statusFilters}
        visibleAppSummary={visibleAppSummary}
        workflowCreateBootstrapRequest={workflowCreateBootstrapRequest}
        workflowCreateWizardProps={workflowCreateWizardProps}
        workspaceUtilityEntry={workspaceUtilityEntry}
        workspaceName={workspaceContext.workspace.name}
        workspaceSignals={workspaceSignals}
      />
    </WorkspaceShell>
  );
}
