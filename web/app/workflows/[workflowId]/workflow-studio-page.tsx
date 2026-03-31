import Link from "next/link";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import type { ReactNode } from "react";

import { WorkflowEditorWorkbenchEntry } from "@/components/workflow-editor-workbench-entry";
import { WorkspaceShell } from "@/components/workspace-shell";
import type { PluginToolRegistryItem } from "@/lib/get-plugin-registry";
import { getServerWorkspaceContext } from "@/lib/server-workspace-access";
import {
  appendWorkflowLibraryViewState,
  readWorkflowLibraryViewState
} from "@/lib/workflow-library-query";
import {
  buildWorkflowStudioSurfaceHref,
  getWorkflowStudioSurfaceDefinition,
  getWorkflowStudioSurfaceDefinitions,
  type WorkflowStudioSurface
} from "@/lib/workbench-links";
import {
  buildWorkflowCreateHrefFromWorkspaceStarterViewState,
  buildWorkflowEditorHrefFromWorkspaceStarterViewState,
  buildWorkflowLibraryHrefFromWorkspaceStarterViewState,
  buildWorkflowPublishHrefFromWorkspaceStarterViewState,
  buildWorkspaceStarterLibraryHrefFromWorkspaceStarterViewState,
  hasScopedWorkspaceStarterGovernanceFilters,
  pickWorkspaceStarterGovernanceQueryScope,
  readWorkspaceStarterLibraryViewState
} from "@/lib/workspace-starter-governance-query";
import { getWorkflowDetail } from "@/lib/get-workflows";
import type { WorkspaceMemberRole } from "@/lib/workspace-access";

export type WorkflowStudioPageProps = {
  params: Promise<{ workflowId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

type WorkflowStudioSharedContext = {
  workspaceName: string;
  userName: string;
  userRole: WorkspaceMemberRole;
  workflow: NonNullable<Awaited<ReturnType<typeof getWorkflowDetail>>>;
  workflowStageLabel: string;
  resolvedSearchParams: Record<string, string | string[] | undefined>;
  workflowLibraryHref: string;
  createWorkflowHref: string;
  surfaceHrefs: Record<WorkflowStudioSurface, string>;
  currentEditorHref: string;
  currentPublishHref: string;
  workspaceStarterLibraryHref: string;
  workspaceStarterGovernanceQueryScope: ReturnType<
    typeof pickWorkspaceStarterGovernanceQueryScope
  >;
  hasScopedWorkspaceStarterFilters: boolean;
};

type WorkflowStudioShellProps = {
  workspaceName: string;
  userName: string;
  userRole: WorkspaceMemberRole;
  workflowName: string;
  workflowVersion: string;
  workflowStageLabel: string;
  workflowLibraryHref: string;
  activeStudioSurface: WorkflowStudioSurface;
  surfaceHrefs: Record<WorkflowStudioSurface, string>;
  workspaceStarterLibraryHref: string;
  children: ReactNode;
};

export async function generateWorkflowStudioMetadata({
  params
}: WorkflowStudioPageProps): Promise<Metadata> {
  const { workflowId } = await params;

  return {
    title: `Workflow ${workflowId} | 7Flows Studio`
  };
}

export async function buildLegacyWorkflowStudioSurfaceRedirectHref({
  params,
  searchParams
}: WorkflowStudioPageProps) {
  const { workflowId } = await params;
  const resolvedSearchParams = await searchParams;
  const activeStudioSurface = readWorkflowStudioSurface(resolvedSearchParams.surface);

  return appendSearchParamsToHref(
    buildWorkflowStudioSurfaceHref(workflowId, activeStudioSurface),
    buildWorkflowStudioSearchParams(resolvedSearchParams, { omitKeys: ["surface"] })
  );
}

export async function renderWorkflowStudioPage({
  params,
  searchParams,
  surface
}: WorkflowStudioPageProps & {
  surface: WorkflowStudioSurface;
}) {
  const sharedContext = await resolveWorkflowStudioSharedContext({
    params,
    searchParams,
    surface
  });

  if (surface === "editor") {
    return renderWorkflowEditorSurface(sharedContext);
  }

  if (surface === "publish") {
    return renderWorkflowPublishSurface(sharedContext);
  }

  return renderWorkflowUtilitySurface(sharedContext, surface);
}

export function readWorkflowStudioSurface(
  value: string | string[] | undefined
): WorkflowStudioSurface {
  const resolvedValue = Array.isArray(value) ? value[0] : value;
  return getWorkflowStudioSurfaceDefinitions().some((item) => item.key === resolvedValue)
    ? (resolvedValue as WorkflowStudioSurface)
    : "editor";
}

async function resolveWorkflowStudioSharedContext({
  params,
  searchParams,
  surface
}: WorkflowStudioPageProps & {
  surface: WorkflowStudioSurface;
}): Promise<WorkflowStudioSharedContext> {
  const { workflowId } = await params;
  const resolvedSearchParams = await searchParams;
  const requestedSurfaceHref = appendSearchParamsToHref(
    buildWorkflowStudioSurfaceHref(workflowId, surface),
    buildWorkflowStudioSearchParams(resolvedSearchParams, { omitKeys: ["surface"] })
  );
  const [workspaceContext, workflow] = await Promise.all([
    getServerWorkspaceContext(),
    getWorkflowDetail(workflowId)
  ]);

  if (!workspaceContext) {
    redirect(`/login?next=${encodeURIComponent(requestedSurfaceHref)}`);
  }

  if (!workflow) {
    notFound();
  }

  const workspaceStarterViewState = readWorkspaceStarterLibraryViewState(
    resolvedSearchParams
  );
  const workflowLibraryViewState = readWorkflowLibraryViewState(resolvedSearchParams);
  const workflowLibraryHref = appendWorkflowLibraryViewState(
    buildWorkflowLibraryHrefFromWorkspaceStarterViewState(workspaceStarterViewState),
    workflowLibraryViewState
  );
  const createWorkflowHref = buildWorkflowCreateHrefFromWorkspaceStarterViewState(
    workspaceStarterViewState
  );
  const editorSurfaceHref = appendWorkflowLibraryViewState(
    buildWorkflowEditorHrefFromWorkspaceStarterViewState(
      workflow.id,
      workspaceStarterViewState
    ),
    workflowLibraryViewState
  );
  const publishSurfaceHref = appendWorkflowLibraryViewState(
    buildWorkflowPublishHrefFromWorkspaceStarterViewState(
      workflow.id,
      workspaceStarterViewState
    ),
    workflowLibraryViewState
  );
  const surfaceSearchParams = buildWorkflowStudioSearchParams(resolvedSearchParams, {
    omitKeys: ["surface"]
  });
  const surfaceHrefs = Object.fromEntries(
    getWorkflowStudioSurfaceDefinitions().map((item) => [
      item.key,
      appendSearchParamsToHref(
        buildWorkflowStudioSurfaceHref(workflow.id, item.key),
        surfaceSearchParams
      )
    ])
  ) as Record<WorkflowStudioSurface, string>;
  const currentEditorHref = appendSearchParamsToHref(
    buildWorkflowStudioSurfaceHref(workflow.id, "editor"),
    surfaceSearchParams
  );
  const currentPublishHref = appendSearchParamsToHref(
    buildWorkflowStudioSurfaceHref(workflow.id, "publish"),
    surfaceSearchParams
  );
  const workspaceStarterLibraryHref =
    buildWorkspaceStarterLibraryHrefFromWorkspaceStarterViewState(
      workspaceStarterViewState
    );
  const workspaceStarterGovernanceQueryScope = pickWorkspaceStarterGovernanceQueryScope(
    workspaceStarterViewState
  );
  const hasScopedWorkspaceStarterFilters = hasScopedWorkspaceStarterGovernanceFilters(
    workspaceStarterViewState
  );

  return {
    workspaceName: workspaceContext.workspace.name,
    userName: workspaceContext.current_user.display_name,
    userRole: workspaceContext.current_member.role,
    workflow,
    workflowStageLabel:
      typeof workflow.publish_count === "number" && workflow.publish_count > 0
        ? "publish ready"
        : "draft only",
    resolvedSearchParams,
    workflowLibraryHref,
    createWorkflowHref,
    surfaceHrefs: {
      ...surfaceHrefs,
      editor: editorSurfaceHref,
      publish: publishSurfaceHref
    },
    currentEditorHref,
    currentPublishHref,
    workspaceStarterLibraryHref,
    workspaceStarterGovernanceQueryScope,
    hasScopedWorkspaceStarterFilters
  };
}

async function renderWorkflowEditorSurface(sharedContext: WorkflowStudioSharedContext) {
  return (
    <WorkflowStudioShell
      workspaceName={sharedContext.workspaceName}
      userName={sharedContext.userName}
      userRole={sharedContext.userRole}
      workflowName={sharedContext.workflow.name}
      workflowVersion={sharedContext.workflow.version}
      workflowStageLabel={sharedContext.workflowStageLabel}
      workflowLibraryHref={sharedContext.workflowLibraryHref}
      activeStudioSurface="editor"
      surfaceHrefs={sharedContext.surfaceHrefs}
      workspaceStarterLibraryHref={sharedContext.workspaceStarterLibraryHref}
    >
      <section className="workflow-studio-surface" data-surface="editor">
        <WorkflowEditorWorkbenchEntry
          bootstrapRequest={{
            workflowId: sharedContext.workflow.id,
            surface: "editor"
          }}
          workflow={sharedContext.workflow}
          currentEditorHref={sharedContext.currentEditorHref}
          workflowLibraryHref={sharedContext.workflowLibraryHref}
          createWorkflowHref={sharedContext.createWorkflowHref}
          workspaceStarterLibraryHref={sharedContext.workspaceStarterLibraryHref}
          hasScopedWorkspaceStarterFilters={sharedContext.hasScopedWorkspaceStarterFilters}
          workspaceStarterGovernanceQueryScope={
            sharedContext.workspaceStarterGovernanceQueryScope
          }
        />
      </section>
    </WorkflowStudioShell>
  );
}

async function renderWorkflowPublishSurface(sharedContext: WorkflowStudioSharedContext) {
  const [
    { WorkflowPublishPanel },
    workflowPublishModule,
    workflowPublishGovernanceModule,
    workflowPublishActivityQueryModule
  ] = await Promise.all([
    import("@/components/workflow-publish-panel"),
    import("@/lib/get-workflow-publish"),
    import("@/lib/get-workflow-publish-governance"),
    import("@/lib/workflow-publish-activity-query")
  ]);
  const publishedEndpoints = await workflowPublishModule.getWorkflowPublishedEndpoints(
    sharedContext.workflow.id,
    {
      includeAllVersions: true
    }
  );
  const workflowStageLabel =
    publishedEndpoints.length > 0 ? "publish ready" : sharedContext.workflowStageLabel;
  const publishActivityQueryScope =
    workflowPublishActivityQueryModule.readWorkflowPublishActivityQueryScope(
      sharedContext.resolvedSearchParams
    );
  const publishActivityFilters =
    workflowPublishActivityQueryModule.resolveWorkflowPublishActivityFilters(
      publishActivityQueryScope,
      publishedEndpoints
    );
  const expandedBindingId = publishActivityFilters.governanceFetchFilter?.bindingId ?? null;
  const expandedBindings = expandedBindingId
    ? publishedEndpoints.filter((binding) => binding.id === expandedBindingId)
    : [];

  let tools: PluginToolRegistryItem[] = [];
  let callbackWaitingAutomation = null;
  let sandboxReadiness = null;
  let governanceSnapshot = {
    cacheInventories: {},
    apiKeysByBinding: {},
    invocationAuditsByBinding: {},
    invocationDetailsByBinding: {},
    rateLimitWindowAuditsByBinding: {}
  };

  if (expandedBindings.length > 0) {
    const [pluginRegistryModule, systemOverviewModule, nextGovernanceSnapshot] =
      await Promise.all([
        import("@/lib/get-plugin-registry"),
        import("@/lib/get-system-overview"),
        workflowPublishGovernanceModule.getWorkflowPublishGovernanceSnapshot(
          sharedContext.workflow.id,
          expandedBindings,
          {
            activeInvocationFilter: publishActivityFilters.governanceFetchFilter
          }
        )
      ]);

    const [pluginRegistry, systemOverview] = await Promise.all([
      pluginRegistryModule.getPluginRegistrySnapshot(),
      systemOverviewModule.getSystemOverview()
    ]);

    tools = pluginRegistry.tools;
    callbackWaitingAutomation = systemOverview.callback_waiting_automation;
    sandboxReadiness = systemOverview.sandbox_readiness;
    governanceSnapshot = nextGovernanceSnapshot;
  }

  const {
    cacheInventories,
    apiKeysByBinding,
    invocationAuditsByBinding,
    invocationDetailsByBinding,
    rateLimitWindowAuditsByBinding
  } = governanceSnapshot;

  return (
    <WorkflowStudioShell
      workspaceName={sharedContext.workspaceName}
      userName={sharedContext.userName}
      userRole={sharedContext.userRole}
      workflowName={sharedContext.workflow.name}
      workflowVersion={sharedContext.workflow.version}
      workflowStageLabel={workflowStageLabel}
      workflowLibraryHref={sharedContext.workflowLibraryHref}
      activeStudioSurface="publish"
      surfaceHrefs={sharedContext.surfaceHrefs}
      workspaceStarterLibraryHref={sharedContext.workspaceStarterLibraryHref}
    >
      <section
        className="workflow-studio-surface workflow-studio-surface-governance"
        data-surface="publish"
      >
        <WorkflowPublishPanel
          workflow={sharedContext.workflow}
          tools={tools}
          bindings={publishedEndpoints}
          cacheInventories={cacheInventories}
          apiKeysByBinding={apiKeysByBinding}
          invocationAuditsByBinding={invocationAuditsByBinding}
          invocationDetailsByBinding={invocationDetailsByBinding}
          selectedInvocationId={publishActivityFilters.selectedInvocationId}
          rateLimitWindowAuditsByBinding={rateLimitWindowAuditsByBinding}
          callbackWaitingAutomation={callbackWaitingAutomation}
          sandboxReadiness={sandboxReadiness}
          activeInvocationFilter={publishActivityFilters.panelActiveFilter}
          expandedBindingId={expandedBindingId}
          workflowLibraryHref={sharedContext.workflowLibraryHref}
          currentHref={sharedContext.currentPublishHref}
          workspaceStarterGovernanceQueryScope={
            sharedContext.workspaceStarterGovernanceQueryScope
          }
        />
      </section>
    </WorkflowStudioShell>
  );
}

function renderWorkflowUtilitySurface(
  sharedContext: WorkflowStudioSharedContext,
  surface: Exclude<WorkflowStudioSurface, "editor" | "publish">
) {
  const surfaceDefinition = getWorkflowStudioSurfaceDefinition(surface);

  return (
    <WorkflowStudioShell
      workspaceName={sharedContext.workspaceName}
      userName={sharedContext.userName}
      userRole={sharedContext.userRole}
      workflowName={sharedContext.workflow.name}
      workflowVersion={sharedContext.workflow.version}
      workflowStageLabel={sharedContext.workflowStageLabel}
      workflowLibraryHref={sharedContext.workflowLibraryHref}
      activeStudioSurface={surface}
      surfaceHrefs={sharedContext.surfaceHrefs}
      workspaceStarterLibraryHref={sharedContext.workspaceStarterLibraryHref}
    >
      <section className="workflow-studio-surface workflow-studio-surface-utility" data-surface={surface}>
        <div
          className="workflow-studio-placeholder-card"
          data-component="workflow-studio-placeholder"
          data-placeholder-surface={surface}
        >
          <p className="workflow-studio-placeholder-eyebrow">Workflow surface</p>
          <h2>{surfaceDefinition.label}</h2>
          <p>{surfaceDefinition.description}</p>
          <div className="workflow-studio-placeholder-actions">
            <Link className="workflow-studio-secondary-link" href={sharedContext.surfaceHrefs.publish}>
              查看发布治理
            </Link>
            <Link className="workflow-studio-secondary-link" href="/runs">
              查看运行诊断
            </Link>
          </div>
        </div>
      </section>
    </WorkflowStudioShell>
  );
}

function WorkflowStudioShell({
  workspaceName,
  userName,
  userRole,
  workflowName,
  workflowVersion,
  workflowStageLabel,
  workflowLibraryHref,
  activeStudioSurface,
  surfaceHrefs,
  workspaceStarterLibraryHref,
  children
}: WorkflowStudioShellProps) {
  const isEditorSurface = activeStudioSurface === "editor";
  const studioModeLabel = getWorkflowStudioSurfaceDefinition(activeStudioSurface).modeLabel;
  const surfaceItems = getWorkflowStudioSurfaceDefinitions();

  return (
    <WorkspaceShell
      activeNav="workflows"
      layout="editor"
      userName={userName}
      userRole={userRole}
      workspaceName={workspaceName}
    >
      <div className="workspace-main workflow-studio-main">
        <section
          className={[
            "workflow-studio-shell-bar",
            isEditorSurface ? "workflow-studio-shell-bar-compact" : null
          ]
            .filter(Boolean)
            .join(" ")}
        >
          <div className="workflow-studio-shell-row">
            <div className="workflow-studio-breadcrumb-row">
              <Link className="workflow-studio-breadcrumb-link" href={workflowLibraryHref}>
                编排中心
              </Link>
              <span className="workflow-studio-breadcrumb-current">{workflowName}</span>
              <span className="workflow-studio-inline-tag">v{workflowVersion}</span>
              <span className="workflow-studio-inline-tag">{workflowStageLabel}</span>
              <span className="workflow-studio-shell-mode">{studioModeLabel}</span>
            </div>

            <nav className="workflow-studio-surface-nav" aria-label="Workflow studio surfaces">
              {surfaceItems.map((item) => (
                <Link
                  className={`workflow-studio-surface-link ${
                    activeStudioSurface === item.key ? "active" : ""
                  }`.trim()}
                  href={surfaceHrefs[item.key]}
                  key={item.key}
                >
                  {item.label}
                </Link>
              ))}
              <span className="workflow-studio-surface-nav-spacer" aria-hidden="true" />
              <div className="workflow-studio-utility-links">
                <Link className="workflow-studio-secondary-link" href="/runs">
                  运行诊断
                </Link>
                <Link className="workflow-studio-secondary-link" href={workspaceStarterLibraryHref}>
                  Starter 模板
                </Link>
              </div>
            </nav>
          </div>
        </section>

        {children}
      </div>
    </WorkspaceShell>
  );
}

function buildWorkflowStudioSearchParams(
  searchParams: Record<string, string | string[] | undefined>,
  options: { omitKeys?: string[] } = {}
) {
  const result = new URLSearchParams();
  const omittedKeys = new Set(options.omitKeys ?? []);

  for (const [key, rawValue] of Object.entries(searchParams).sort(([left], [right]) =>
    left.localeCompare(right)
  )) {
    if (omittedKeys.has(key) || typeof rawValue === "undefined") {
      continue;
    }

    const values = Array.isArray(rawValue) ? rawValue : [rawValue];

    for (const value of values) {
      result.append(key, value);
    }
  }

  return result;
}

function appendSearchParamsToHref(href: string, searchParams: URLSearchParams) {
  const query = searchParams.toString();
  return query ? `${href}?${query}` : href;
}
