const BUILTIN_WORKFLOW_NODE_LABELS: Record<string, string> = {
  startNode: "开始",
  endNode: "直接回复"
};

export function getWorkflowNodeTypeDisplayLabel(
  nodeType: string,
  typeLabel?: string | null
) {
  const normalizedTypeLabel = normalizeString(typeLabel);
  const builtinLabel = BUILTIN_WORKFLOW_NODE_LABELS[nodeType];

  if (!builtinLabel) {
    return normalizedTypeLabel ?? nodeType;
  }

  if (!normalizedTypeLabel || normalizedTypeLabel === nodeType) {
    return builtinLabel;
  }

  return normalizedTypeLabel;
}

export function getWorkflowNodeDisplayLabel({
  nodeType,
  label,
  typeLabel
}: {
  nodeType: string;
  label?: string | null;
  typeLabel?: string | null;
}) {
  const normalizedLabel = normalizeString(label);
  const resolvedTypeLabel = getWorkflowNodeTypeDisplayLabel(nodeType, typeLabel);
  const builtinLabel = BUILTIN_WORKFLOW_NODE_LABELS[nodeType];

  if (!normalizedLabel) {
    return resolvedTypeLabel;
  }

  if (!builtinLabel) {
    return normalizedLabel;
  }

  if (normalizedLabel === builtinLabel || normalizedLabel === nodeType) {
    return builtinLabel;
  }

  if (normalizedLabel.startsWith(`${nodeType} `)) {
    return `${builtinLabel}${normalizedLabel.slice(nodeType.length)}`;
  }

  return normalizedLabel;
}

export function formatWorkflowNodeMeta(
  capabilityGroup: string | undefined,
  nodeType: string,
  typeLabel?: string | null
) {
  const groupLabel = capabilityGroup ? capabilityGroup.replace(/_/g, " ") : "workflow";
  return `${groupLabel} · ${getWorkflowNodeTypeDisplayLabel(nodeType, typeLabel)}`;
}

function normalizeString(value: string | null | undefined) {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  return normalized || null;
}
