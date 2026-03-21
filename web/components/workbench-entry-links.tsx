import React from "react";
import Link from "next/link";

const WORKBENCH_ENTRY_LINK_REGISTRY = {
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

type WorkbenchEntryLinkDefinition = {
  href: string;
  label: string;
};

type WorkbenchEntryLinkOverrides = Partial<
  Record<WorkbenchEntryLinkKey, Partial<WorkbenchEntryLinkDefinition>>
>;

type WorkbenchEntryLinksProps = {
  keys: WorkbenchEntryLinkKey[];
  overrides?: WorkbenchEntryLinkOverrides;
  variant?: "hero" | "inline";
  primaryKey?: WorkbenchEntryLinkKey;
};

export function resolveWorkbenchEntryLinks(
  keys: WorkbenchEntryLinkKey[],
  overrides: WorkbenchEntryLinkOverrides = {}
) {
  return keys.map((key) => ({
    key,
    href: overrides[key]?.href ?? WORKBENCH_ENTRY_LINK_REGISTRY[key].href,
    label: overrides[key]?.label ?? WORKBENCH_ENTRY_LINK_REGISTRY[key].label
  }));
}

export function WorkbenchEntryLinks({
  keys,
  overrides,
  variant = "hero",
  primaryKey
}: WorkbenchEntryLinksProps) {
  const links = resolveWorkbenchEntryLinks(keys, overrides);

  return (
    <div className={variant === "hero" ? "hero-actions" : "section-actions"}>
      {links.map((link, index) => {
        const className =
          variant === "hero"
            ? "ghost-button"
            : link.key === primaryKey || (!primaryKey && index === 0)
              ? "inline-link"
              : "inline-link secondary";

        return (
          <Link className={className} href={link.href} key={`${variant}-${link.key}-${link.href}`}>
            {link.label}
          </Link>
        );
      })}
    </div>
  );
}
