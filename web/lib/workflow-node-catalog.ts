import type { WorkflowNodeItem } from "@/lib/get-workflows";
import type { WorkflowNodeCatalogItem } from "@/lib/get-workflow-library";

export type WorkflowNodeType = WorkflowNodeCatalogItem["type"];

type WorkflowCatalogNodeBlueprint = {
  id: string;
  type: WorkflowNodeType;
  name?: string;
  position?: { x: number; y: number };
  config?: Record<string, unknown>;
};

export function getWorkflowNodeCatalogItem(
  catalog: WorkflowNodeCatalogItem[],
  type: string
) {
  return catalog.find((item) => item.type === type) ?? null;
}

export function getPaletteNodeCatalog(catalog: WorkflowNodeCatalogItem[]) {
  return [...catalog]
    .filter((item) => item.palette.enabled)
    .sort((left, right) => left.palette.order - right.palette.order);
}

export function getWorkflowNodeDefaultPosition(
  catalog: WorkflowNodeCatalogItem[],
  type: string
) {
  const item = getWorkflowNodeCatalogItem(catalog, type);
  return item?.palette.defaultPosition ?? { x: 240, y: 120 };
}

export function buildCatalogNodeDefinition(
  catalog: WorkflowNodeCatalogItem[],
  blueprint: WorkflowCatalogNodeBlueprint
): WorkflowNodeItem {
  const item = getWorkflowNodeCatalogItem(catalog, blueprint.type);
  const baseConfig = item ? structuredClone(item.defaults.config) : {};

  return {
    id: blueprint.id,
    type: blueprint.type,
    name: blueprint.name ?? item?.defaults.name ?? blueprint.type,
    config: withCanvasPosition(
      {
        ...baseConfig,
        ...(blueprint.config ?? {})
      },
      blueprint.position ?? getWorkflowNodeDefaultPosition(catalog, blueprint.type)
    )
  };
}

function withCanvasPosition(
  config: Record<string, unknown>,
  position: { x: number; y: number }
) {
  const nextConfig = structuredClone(config);
  const ui = toOptionalRecord(nextConfig.ui) ?? {};
  nextConfig.ui = {
    ...ui,
    position: {
      x: Math.round(position.x),
      y: Math.round(position.y)
    }
  };
  return nextConfig;
}

function toOptionalRecord(value: unknown) {
  return isRecord(value) ? { ...value } : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
