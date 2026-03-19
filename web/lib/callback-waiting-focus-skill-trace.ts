import type { SkillReferenceLoadItem } from "@/lib/get-run-views";

import { formatMetricSummary } from "@/lib/run-execution-focus-presenters";

type SharedSkillTraceNode = {
  node_run_id: string;
  node_id?: string | null;
  node_name?: string | null;
  reference_count: number;
  loads: SkillReferenceLoadItem[];
};

type SharedSkillTrace = {
  scope: "execution_focus_node" | "run";
  reference_count: number;
  phase_counts: Record<string, number>;
  source_counts: Record<string, number>;
  nodes: SharedSkillTraceNode[];
};

type CallbackWaitingSkillTraceNodeModel = {
  key: string;
  nodeRunId: string;
  label: string;
  loads: SkillReferenceLoadItem[];
};

export type CallbackWaitingFocusSkillTraceModel = {
  source: "execution_focus_node" | "run" | "node_loads";
  referenceCount: number;
  phaseSummary: string | null;
  sourceSummary: string | null;
  nodes: CallbackWaitingSkillTraceNodeModel[];
};

type BuildCallbackWaitingFocusSkillTraceModelInput = {
  skillTrace?: SharedSkillTrace | null;
  fallbackNodeRunId?: string | null;
  fallbackNodeId?: string | null;
  fallbackNodeName?: string | null;
  fallbackLoads?: SkillReferenceLoadItem[];
  fallbackReferenceCount?: number | null;
};

function trimOrNull(value?: string | null) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function buildNodeLabel(node: {
  node_run_id: string;
  node_id?: string | null;
  node_name?: string | null;
}) {
  return trimOrNull(node.node_name) ?? trimOrNull(node.node_id) ?? node.node_run_id;
}

function aggregateLoadMetrics(loads: SkillReferenceLoadItem[]) {
  const phaseCounts: Record<string, number> = {};
  const sourceCounts: Record<string, number> = {};
  let referenceCount = 0;

  for (const load of loads) {
    const phase = trimOrNull(load.phase) ?? "unknown";
    const loadCount = load.references.length;
    if (loadCount > 0) {
      phaseCounts[phase] = (phaseCounts[phase] ?? 0) + loadCount;
    }
    for (const reference of load.references) {
      referenceCount += 1;
      const source = trimOrNull(reference.load_source) ?? "unknown";
      sourceCounts[source] = (sourceCounts[source] ?? 0) + 1;
    }
  }

  return {
    referenceCount,
    phaseCounts,
    sourceCounts,
    phaseSummary: formatMetricSummary(phaseCounts),
    sourceSummary: formatMetricSummary(sourceCounts)
  };
}

export function pickCallbackWaitingSkillTraceForNode(
  skillTrace: SharedSkillTrace | null | undefined,
  nodeRunId?: string | null
): SharedSkillTrace | null {
  const resolvedNodeRunId = trimOrNull(nodeRunId);
  if (!skillTrace || !resolvedNodeRunId) {
    return null;
  }

  const nodes = skillTrace.nodes.filter((node) => node.node_run_id === resolvedNodeRunId);
  if (nodes.length === 0) {
    return null;
  }

  const phaseCounts: Record<string, number> = {};
  const sourceCounts: Record<string, number> = {};
  let referenceCount = 0;

  for (const node of nodes) {
    const aggregated = aggregateLoadMetrics(node.loads);
    for (const [phase, count] of Object.entries(aggregated.phaseCounts)) {
      phaseCounts[phase] = (phaseCounts[phase] ?? 0) + count;
    }
    for (const [source, count] of Object.entries(aggregated.sourceCounts)) {
      sourceCounts[source] = (sourceCounts[source] ?? 0) + count;
    }
    referenceCount += node.reference_count > 0 ? node.reference_count : aggregated.referenceCount;
  }

  return {
    scope: skillTrace.scope,
    reference_count: referenceCount,
    phase_counts: phaseCounts,
    source_counts: sourceCounts,
    nodes
  };
}

export function buildCallbackWaitingFocusSkillTraceModel(
  input: BuildCallbackWaitingFocusSkillTraceModelInput
): CallbackWaitingFocusSkillTraceModel | null {
  if (input.skillTrace && input.skillTrace.reference_count > 0 && input.skillTrace.nodes.length > 0) {
    const nodes = input.skillTrace.nodes
      .filter((node) => node.loads.length > 0 || node.reference_count > 0)
      .map((node) => ({
        key: `${node.node_run_id}:${buildNodeLabel(node)}`,
        nodeRunId: node.node_run_id,
        label: buildNodeLabel(node),
        loads: node.loads
      }));

    if (nodes.length > 0) {
      return {
        source: input.skillTrace.scope,
        referenceCount: input.skillTrace.reference_count,
        phaseSummary: formatMetricSummary(input.skillTrace.phase_counts),
        sourceSummary: formatMetricSummary(input.skillTrace.source_counts),
        nodes
      };
    }
  }

  const fallbackLoads = input.fallbackLoads ?? [];
  const aggregated = aggregateLoadMetrics(fallbackLoads);
  const fallbackReferenceCount =
    typeof input.fallbackReferenceCount === "number" && input.fallbackReferenceCount > 0
      ? input.fallbackReferenceCount
      : aggregated.referenceCount;
  const fallbackNodeRunId = trimOrNull(input.fallbackNodeRunId);

  if (!fallbackNodeRunId || fallbackReferenceCount === 0 || fallbackLoads.length === 0) {
    return null;
  }

  return {
    source: "node_loads",
    referenceCount: fallbackReferenceCount,
    phaseSummary: aggregated.phaseSummary,
    sourceSummary: aggregated.sourceSummary,
    nodes: [
      {
        key: `${fallbackNodeRunId}:${trimOrNull(input.fallbackNodeName) ?? trimOrNull(input.fallbackNodeId) ?? fallbackNodeRunId}`,
        nodeRunId: fallbackNodeRunId,
        label: trimOrNull(input.fallbackNodeName) ?? trimOrNull(input.fallbackNodeId) ?? fallbackNodeRunId,
        loads: fallbackLoads
      }
    ]
  };
}
