import Link from "next/link";
import { MenuFoldOutlined } from "@ant-design/icons";
import { Button } from "antd";

import {
  buildWorkflowStudioSurfaceHref,
  getWorkflowStudioSurfaceDefinition,
  getWorkflowStudioSurfaceDefinitions,
  type WorkflowStudioSurface
} from "@/lib/workbench-links";

const PRIMARY_WORKFLOW_STUDIO_SURFACES = getWorkflowStudioSurfaceDefinitions().filter(
  (item) => item.key !== "publish"
);

type WorkflowStudioSidebarProps = {
  workflowId: string;
  workflowName: string;
  workflowVersion: string;
  workflowStageLabel: string;
  workflowLibraryHref: string;
  activeStudioSurface: WorkflowStudioSurface;
  workspaceStarterLibraryHref: string;
  surfaceHrefs?: Partial<Record<WorkflowStudioSurface, string>>;
  runsHref?: string;
  className?: string;
  dataComponent?: string;
  onCollapse?: () => void;
};

function resolveWorkflowStudioSidebarHref(
  workflowId: string,
  surface: WorkflowStudioSurface,
  surfaceHrefs?: Partial<Record<WorkflowStudioSurface, string>>
) {
  return surfaceHrefs?.[surface] ?? buildWorkflowStudioSurfaceHref(workflowId, surface);
}

export function WorkflowStudioSidebar({
  workflowId,
  workflowName,
  workflowVersion,
  workflowStageLabel,
  workflowLibraryHref,
  activeStudioSurface,
  workspaceStarterLibraryHref,
  surfaceHrefs,
  runsHref = "/runs",
  className,
  dataComponent = "workflow-studio-sidebar",
  onCollapse
}: WorkflowStudioSidebarProps) {
  const studioModeLabel = getWorkflowStudioSurfaceDefinition(activeStudioSurface).modeLabel;
  const contentClassName = className?.trim() ? className : undefined;

  return (
    <div className={contentClassName} data-component={dataComponent}>
      {onCollapse ? (
        <div className="workflow-editor-sidebar-studio-rail-head">
          <div className="workflow-studio-rail-header">
            <div className="workflow-studio-breadcrumb-row">
              <Link className="workflow-studio-breadcrumb-link" href={workflowLibraryHref}>
                编排中心
              </Link>
              <span className="workflow-studio-breadcrumb-current">{workflowName}</span>
            </div>

            <div className="workflow-studio-inline-metrics">
              <span className="workflow-studio-inline-tag">v{workflowVersion}</span>
              <span className="workflow-studio-inline-tag">{workflowStageLabel}</span>
              <span className="workflow-studio-shell-mode">{studioModeLabel}</span>
            </div>
          </div>

          <Button
            aria-label="收起左侧栏"
            className="workflow-editor-sidebar-collapse-button"
            data-action="collapse-sidebar"
            icon={<MenuFoldOutlined />}
            onClick={onCollapse}
            type="text"
          />
        </div>
      ) : (
        <div className="workflow-studio-rail-header">
          <div className="workflow-studio-breadcrumb-row">
            <Link className="workflow-studio-breadcrumb-link" href={workflowLibraryHref}>
              编排中心
            </Link>
            <span className="workflow-studio-breadcrumb-current">{workflowName}</span>
          </div>

          <div className="workflow-studio-inline-metrics">
            <span className="workflow-studio-inline-tag">v{workflowVersion}</span>
            <span className="workflow-studio-inline-tag">{workflowStageLabel}</span>
            <span className="workflow-studio-shell-mode">{studioModeLabel}</span>
          </div>
        </div>
      )}

      <nav className="workflow-studio-surface-rail" aria-label="Workflow studio surfaces">
        {PRIMARY_WORKFLOW_STUDIO_SURFACES.map((item) => (
          <Link
            className={`workflow-studio-rail-link ${
              activeStudioSurface === item.key ? "active" : ""
            }`.trim()}
            href={resolveWorkflowStudioSidebarHref(workflowId, item.key, surfaceHrefs)}
            key={item.key}
          >
            <strong>{item.label}</strong>
            <span>{item.description}</span>
          </Link>
        ))}
      </nav>

      <div className="workflow-studio-rail-secondary">
        <Link
          className={`workflow-studio-rail-secondary-link ${
            activeStudioSurface === "publish" ? "active" : ""
          }`.trim()}
          href={resolveWorkflowStudioSidebarHref(workflowId, "publish", surfaceHrefs)}
        >
          发布治理
        </Link>
        <Link className="workflow-studio-rail-secondary-link" href={runsHref}>
          运行诊断
        </Link>
        <Link
          className="workflow-studio-rail-secondary-link"
          href={workspaceStarterLibraryHref}
        >
          Starter 模板
        </Link>
      </div>
    </div>
  );
}
