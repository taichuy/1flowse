import React from "react";
import Link from "next/link";
import {
  resolveWorkbenchEntryLink,
  resolveWorkbenchEntryLinks,
  type WorkbenchEntryLinkKey,
  type WorkbenchEntryLinkOverride,
  type WorkbenchEntryLinkOverrides
} from "@/lib/workbench-entry-links";

export {
  resolveWorkbenchEntryLink,
  resolveWorkbenchEntryLinks
} from "@/lib/workbench-entry-links";

export type {
  WorkbenchEntryLinkDefinition,
  WorkbenchEntryLinkKey,
  WorkbenchEntryLinkOverride,
  WorkbenchEntryLinkOverrides,
  WorkbenchEntryLinksConfig
} from "@/lib/workbench-entry-links";

type WorkbenchEntryLinksProps = {
  keys: WorkbenchEntryLinkKey[];
  overrides?: WorkbenchEntryLinkOverrides;
  variant?: "hero" | "inline";
  primaryKey?: WorkbenchEntryLinkKey;
};

type WorkbenchEntryLinkProps = {
  linkKey: WorkbenchEntryLinkKey;
  override?: WorkbenchEntryLinkOverride;
  className?: string;
  children?: React.ReactNode;
};

export function WorkbenchEntryLink({
  linkKey,
  override,
  className = "inline-link",
  children
}: WorkbenchEntryLinkProps) {
  const link = resolveWorkbenchEntryLink(linkKey, override);

  return (
    <Link className={className} href={link.href}>
      {children ?? link.label}
    </Link>
  );
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
