import type { WorkflowDefinition } from "@/lib/workflow-editor";
import {
  resolveDefaultExecutionClass,
  WORKFLOW_EXECUTION_CLASS_OPTIONS,
  WORKFLOW_EXECUTION_DEPENDENCY_MODE_OPTIONS,
  type WorkflowExecutionClass,
  type WorkflowExecutionDependencyMode
} from "@/lib/workflow-runtime-policy";

export type WorkflowDefinitionSandboxGovernanceNode = {
  id: string;
  name: string;
  executionClass: WorkflowExecutionClass;
  explicitExecution: boolean;
  dependencyMode?: WorkflowExecutionDependencyMode;
  builtinPackageSet?: string;
  dependencyRef?: string;
  backendExtensionKeys: string[];
};

export type WorkflowDefinitionSandboxGovernance = {
  sandboxNodeCount: number;
  explicitExecutionCount: number;
  executionClasses: WorkflowExecutionClass[];
  dependencyModes: WorkflowExecutionDependencyMode[];
  dependencyModeCounts: Partial<Record<WorkflowExecutionDependencyMode, number>>;
  builtinPackageSets: string[];
  dependencyRefs: string[];
  backendExtensionNodeCount: number;
  backendExtensionKeys: string[];
  nodes: WorkflowDefinitionSandboxGovernanceNode[];
};

const EMPTY_SANDBOX_GOVERNANCE: WorkflowDefinitionSandboxGovernance = {
  sandboxNodeCount: 0,
  explicitExecutionCount: 0,
  executionClasses: [],
  dependencyModes: [],
  dependencyModeCounts: {},
  builtinPackageSets: [],
  dependencyRefs: [],
  backendExtensionNodeCount: 0,
  backendExtensionKeys: [],
  nodes: []
};

export function summarizeWorkflowDefinitionSandboxGovernance(
  definition: WorkflowDefinition
): WorkflowDefinitionSandboxGovernance {
  const nodes = (definition.nodes ?? [])
    .filter((node) => node.type === "sandbox_code")
    .map((node) => buildSandboxGovernanceNode(node));

  if (nodes.length === 0) {
    return EMPTY_SANDBOX_GOVERNANCE;
  }

  const dependencyModeCounts = nodes.reduce<
    Partial<Record<WorkflowExecutionDependencyMode, number>>
  >((counts, node) => {
    const dependencyMode = node.dependencyMode;
    if (!dependencyMode) {
      return counts;
    }
    counts[dependencyMode] = (counts[dependencyMode] ?? 0) + 1;
    return counts;
  }, {});

  return {
    sandboxNodeCount: nodes.length,
    explicitExecutionCount: nodes.filter((node) => node.explicitExecution).length,
    executionClasses: collectUnique(nodes.map((node) => node.executionClass)),
    dependencyModes: collectUnique(
      nodes
        .map((node) => node.dependencyMode)
        .filter((mode): mode is WorkflowExecutionDependencyMode => Boolean(mode))
    ),
    dependencyModeCounts,
    builtinPackageSets: collectUnique(
      nodes
        .map((node) => node.builtinPackageSet)
        .filter((value): value is string => Boolean(value))
    ),
    dependencyRefs: collectUnique(
      nodes
        .map((node) => node.dependencyRef)
        .filter((value): value is string => Boolean(value))
    ),
    backendExtensionNodeCount: nodes.filter((node) => node.backendExtensionKeys.length > 0).length,
    backendExtensionKeys: collectUnique(nodes.flatMap((node) => node.backendExtensionKeys)),
    nodes
  };
}

export function buildWorkflowDefinitionSandboxGovernanceTags(
  governance: WorkflowDefinitionSandboxGovernance
): string[] {
  if (governance.sandboxNodeCount === 0) {
    return [];
  }

  const tags = ["sandbox_code"];

  for (const executionClass of governance.executionClasses) {
    tags.push(`execution:${executionClass}`);
  }
  for (const dependencyMode of governance.dependencyModes) {
    tags.push(`dependencyMode:${dependencyMode}`);
  }
  for (const builtinPackageSet of governance.builtinPackageSets) {
    tags.push(`builtinPackageSet:${builtinPackageSet}`);
  }
  for (const dependencyRef of governance.dependencyRefs) {
    tags.push(`dependencyRef:${dependencyRef}`);
  }
  if (governance.backendExtensionNodeCount > 0) {
    tags.push("backendExtensions");
  }

  return collectUnique(tags);
}

export function buildWorkflowDefinitionSandboxGovernanceBadges(
  governance: WorkflowDefinitionSandboxGovernance
): string[] {
  if (governance.sandboxNodeCount === 0) {
    return [];
  }

  const badges = [`sandbox ${governance.sandboxNodeCount}`];
  if (governance.executionClasses.length > 0) {
    badges.push(`execution ${governance.executionClasses.join(" / ")}`);
  }
  if (governance.dependencyModes.length > 0) {
    badges.push(`deps ${governance.dependencyModes.join(" / ")}`);
  }
  if (governance.builtinPackageSets.length > 0) {
    badges.push(`builtin ${governance.builtinPackageSets.join(" / ")}`);
  }
  if (governance.dependencyRefs.length > 0) {
    badges.push(`dependency ref ${governance.dependencyRefs.join(" / ")}`);
  }
  if (governance.backendExtensionKeys.length > 0) {
    badges.push(`extensions ${governance.backendExtensionKeys.join(", ")}`);
  }

  return badges;
}

export function describeWorkflowDefinitionSandboxDependency(
  governance: WorkflowDefinitionSandboxGovernance
): string | null {
  if (governance.sandboxNodeCount === 0) {
    return null;
  }

  const facts: string[] = [];
  const hasExplicitDependencyFacts =
    governance.dependencyModes.length > 0 ||
    governance.builtinPackageSets.length > 0 ||
    governance.dependencyRefs.length > 0 ||
    governance.backendExtensionKeys.length > 0 ||
    governance.executionClasses.some((executionClass) => executionClass !== "sandbox");

  if (!hasExplicitDependencyFacts) {
    return null;
  }

  if (governance.executionClasses.length > 0) {
    facts.push(`execution = ${governance.executionClasses.join(" / ")}`);
  }
  if (governance.dependencyModes.length > 0) {
    facts.push(`dependencyMode = ${governance.dependencyModes.join(" / ")}`);
  }
  if (governance.builtinPackageSets.length > 0) {
    facts.push(`builtinPackageSet = ${governance.builtinPackageSets.join(" / ")}`);
  }
  if (governance.dependencyRefs.length > 0) {
    facts.push(`dependencyRef = ${governance.dependencyRefs.join(" / ")}`);
  }
  if (governance.backendExtensionKeys.length > 0) {
    facts.push(`backendExtensions = ${governance.backendExtensionKeys.join(", ")}`);
  }

  return facts.length > 0 ? `sandbox 依赖事实：${facts.join(" · ")}` : null;
}

function buildSandboxGovernanceNode(
  node: NonNullable<WorkflowDefinition["nodes"]>[number]
) {
  const runtimePolicy = isRecord(node.runtimePolicy) ? node.runtimePolicy : {};
  const execution = isRecord(runtimePolicy.execution) ? runtimePolicy.execution : null;
  const executionClass = isExecutionClass(execution?.class)
    ? execution.class
    : resolveDefaultExecutionClass("sandbox_code");
  const dependencyMode = isExecutionDependencyMode(execution?.dependencyMode)
    ? execution.dependencyMode
    : undefined;
  const backendExtensions = isRecord(execution?.backendExtensions)
    ? execution.backendExtensions
    : null;

  return {
    id: node.id,
    name: typeof node.name === "string" && node.name.trim() ? node.name.trim() : node.id,
    executionClass,
    explicitExecution: Boolean(execution),
    dependencyMode,
    builtinPackageSet:
      dependencyMode === "builtin" ? normalizeText(execution?.builtinPackageSet) : undefined,
    dependencyRef:
      dependencyMode === "dependency_ref" ? normalizeText(execution?.dependencyRef) : undefined,
    backendExtensionKeys: backendExtensions
      ? Object.keys(backendExtensions).filter((key) => key.trim().length > 0)
      : []
  } satisfies WorkflowDefinitionSandboxGovernanceNode;
}

function collectUnique<T extends string>(items: T[]): T[] {
  return Array.from(new Set(items));
}

function normalizeText(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value.trim();
  return normalized || undefined;
}

function isExecutionClass(value: unknown): value is WorkflowExecutionClass {
  return (
    typeof value === "string" &&
    WORKFLOW_EXECUTION_CLASS_OPTIONS.includes(value as WorkflowExecutionClass)
  );
}

function isExecutionDependencyMode(value: unknown): value is WorkflowExecutionDependencyMode {
  return (
    typeof value === "string" &&
    WORKFLOW_EXECUTION_DEPENDENCY_MODE_OPTIONS.includes(value as WorkflowExecutionDependencyMode)
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
