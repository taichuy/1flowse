import * as React from "react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import {
  WorkbenchEntryLinks,
  resolveWorkbenchEntryLinks
} from "@/components/workbench-entry-links";

Object.assign(globalThis, { React });

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: { children: ReactNode; href?: string } & Record<string, unknown>) =>
    createElement("a", { href: href ?? "#", ...props }, children)
}));

describe("workbench entry links", () => {
  it("resolves the shared workbench routes in a stable order", () => {
    expect(
      resolveWorkbenchEntryLinks(["workflowLibrary", "runLibrary", "operatorInbox"])
    ).toEqual([
      {
        key: "workflowLibrary",
        href: "/workflows",
        label: "打开 workflow 列表"
      },
      {
        key: "runLibrary",
        href: "/runs",
        label: "查看 run diagnostics"
      },
      {
        key: "operatorInbox",
        href: "/sensitive-access",
        label: "打开 sensitive access inbox"
      }
    ]);
  });

  it("supports scoped overrides without forking the shared contract", () => {
    const html = renderToStaticMarkup(
      createElement(WorkbenchEntryLinks, {
        keys: ["operatorInbox", "workflowLibrary"],
        variant: "inline",
        primaryKey: "operatorInbox",
        overrides: {
          operatorInbox: {
            href: "/sensitive-access?status=pending",
            label: "打开待处理收件箱"
          }
        }
      })
    );

    expect(html).toContain("打开待处理收件箱");
    expect(html).toContain('/sensitive-access?status=pending');
    expect(html).toContain('/workflows');
  });
});
