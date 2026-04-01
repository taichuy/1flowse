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

export type UnsupportedWorkflowNodeSummary = {
  type: string;
  label: string;
  count: number;
  supportStatus: WorkflowNodeCatalogItem["supportStatus"] | "unknown";
  supportSummary: string;
};

const PRIMARY_AUTHORING_NODE_TYPES = [
  "llm_agent",
  "reference",
  "tool",
  "condition"
] as const;

export function formatUnsupportedWorkflowNodes(
  items: UnsupportedWorkflowNodeSummary[]
) {
  return items
    .map((item) => {
      const suffix = item.supportStatus === "unknown" ? "unknown" : item.supportStatus;
      return `${item.label} x${item.count} (${suffix})`;
    })
    .join(" / ");
}

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

export function sortWorkflowNodeCatalogForAuthoring(catalog: WorkflowNodeCatalogItem[]) {
  const primaryTypeOrder = new Map<string, number>(
    PRIMARY_AUTHORING_NODE_TYPES.map((type, index) => [type, index])
  );

  return [...catalog].sort((left, right) => {
    const leftPrimaryIndex = primaryTypeOrder.get(left.type);
    const rightPrimaryIndex = primaryTypeOrder.get(right.type);

    if (typeof leftPrimaryIndex === "number" || typeof rightPrimaryIndex === "number") {
      if (typeof leftPrimaryIndex !== "number") {
        return 1;
      }
      if (typeof rightPrimaryIndex !== "number") {
        return -1;
      }
      if (leftPrimaryIndex !== rightPrimaryIndex) {
        return leftPrimaryIndex - rightPrimaryIndex;
      }
    }

    if (left.palette.order !== right.palette.order) {
      return left.palette.order - right.palette.order;
    }

    return left.label.localeCompare(right.label);
  });
}

export function getPrimaryAuthoringNodeCatalog(catalog: WorkflowNodeCatalogItem[]) {
  const catalogByType = new Map(catalog.map((item) => [item.type, item]));

  return PRIMARY_AUTHORING_NODE_TYPES.flatMap((type) => {
    const item = catalogByType.get(type);
    return item ? [item] : [];
  });
}

export function getPlannedNodeCatalog(catalog: WorkflowNodeCatalogItem[]) {
  return [...catalog]
    .filter((item) => item.supportStatus !== "available")
    .sort((left, right) => left.palette.order - right.palette.order);
}

export function summarizeUnsupportedWorkflowNodes(
  catalog: WorkflowNodeCatalogItem[],
  nodes: WorkflowNodeItem[]
) {
  const catalogByType = new Map(catalog.map((item) => [item.type, item]));
  const summaryByType = new Map<string, UnsupportedWorkflowNodeSummary>();

  for (const node of nodes) {
    const catalogItem = catalogByType.get(node.type);
    const supportStatus = catalogItem?.supportStatus ?? "unknown";
    if (supportStatus === "available") {
      continue;
    }

    const typeKey = catalogItem?.type ?? node.type;
    const existing = summaryByType.get(typeKey);
    if (existing) {
      existing.count += 1;
      continue;
    }

    summaryByType.set(typeKey, {
      type: typeKey,
      label: catalogItem?.label ?? node.type,
      count: 1,
      supportStatus,
      supportSummary:
        catalogItem?.supportSummary ||
        "当前 catalog 未声明该节点类型，编辑器无法保证画布与 runtime 的一致语义。"
    });
  }

  return [...summaryByType.values()].sort((left, right) => left.label.localeCompare(right.label));
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
