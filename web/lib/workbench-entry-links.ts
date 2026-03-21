export const WORKBENCH_ENTRY_LINK_REGISTRY = {
  home: {
    href: "/",
    label: "返回系统首页"
  },
  workflowLibrary: {
    href: "/workflows",
    label: "打开 workflow 列表"
  },
  runLibrary: {
    href: "/runs",
    label: "查看 run diagnostics"
  },
  operatorInbox: {
    href: "/sensitive-access",
    label: "打开 sensitive access inbox"
  },
  createWorkflow: {
    href: "/workflows/new",
    label: "新建 workflow"
  },
  workspaceStarterLibrary: {
    href: "/workspace-starters",
    label: "管理 workspace starters"
  }
} as const;

export type WorkbenchEntryLinkKey = keyof typeof WORKBENCH_ENTRY_LINK_REGISTRY;

export type WorkbenchEntryLinkDefinition = {
  href: string;
  label: string;
};

export type WorkbenchEntryLinkOverride = Partial<WorkbenchEntryLinkDefinition>;

export type WorkbenchEntryLinkOverrides = Partial<
  Record<WorkbenchEntryLinkKey, WorkbenchEntryLinkOverride>
>;

export type WorkbenchEntryLinksConfig = {
  keys: WorkbenchEntryLinkKey[];
  overrides?: WorkbenchEntryLinkOverrides;
  variant?: "hero" | "inline";
  primaryKey?: WorkbenchEntryLinkKey;
};

export function resolveWorkbenchEntryLink(
  key: WorkbenchEntryLinkKey,
  override: WorkbenchEntryLinkOverride = {}
) {
  return {
    key,
    href: override.href ?? WORKBENCH_ENTRY_LINK_REGISTRY[key].href,
    label: override.label ?? WORKBENCH_ENTRY_LINK_REGISTRY[key].label
  };
}

export function resolveWorkbenchEntryLinks(
  keys: WorkbenchEntryLinkKey[],
  overrides: WorkbenchEntryLinkOverrides = {}
) {
  return keys.map((key) => resolveWorkbenchEntryLink(key, overrides[key]));
}
