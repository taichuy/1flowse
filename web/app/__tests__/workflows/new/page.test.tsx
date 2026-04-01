import * as React from "react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import NewWorkflowPage from "@/app/workflows/new/page";
import { loadWorkflowCreateWizardBootstrap } from "@/components/workflow-create-wizard/bootstrap";
import { getServerWorkspaceContext } from "@/lib/server-workspace-access";

Object.assign(globalThis, { React });

vi.mock("next/navigation", () => ({
  redirect: (href: string) => {
    throw new Error(`redirect:${href}`);
  }
}));

vi.mock("@/components/workspace-shell", () => ({
  WorkspaceShell: ({ children }: { children: ReactNode }) =>
    createElement("div", { "data-component": "workspace-shell" }, children)
}));

vi.mock("@/components/workflow-create-wizard-entry", () => ({
  WorkflowCreateWizardEntry: ({
    bootstrapRequest,
    initialBootstrapData
  }: {
    bootstrapRequest: {
      governanceQueryScope: { kind?: string };
      includeLegacyAuthGovernanceSnapshot: boolean;
      libraryQuery: {
        includeStarterDefinitions: boolean;
        includeBuiltinStarters: boolean;
      };
    };
    initialBootstrapData?: { starters?: unknown[]; workflows?: unknown[] } | null;
  }) =>
    createElement(
      "div",
      {
        "data-component": "workflow-create-wizard-entry",
        "data-has-initial-bootstrap": initialBootstrapData ? "true" : "false",
        "data-bootstrap-starters-count": initialBootstrapData?.starters?.length ?? 0,
        "data-bootstrap-workflows-count": initialBootstrapData?.workflows?.length ?? 0,
        "data-governance-kind": bootstrapRequest.governanceQueryScope.kind ?? "unknown",
        "data-loads-legacy-auth": String(
          bootstrapRequest.includeLegacyAuthGovernanceSnapshot
        ),
        "data-include-starter-definitions": String(
          bootstrapRequest.libraryQuery.includeStarterDefinitions
        ),
        "data-include-builtin-starters": String(
          bootstrapRequest.libraryQuery.includeBuiltinStarters
        )
      },
      "wizard-entry"
    )
}));

vi.mock("@/lib/server-workspace-access", () => ({
  getServerWorkspaceContext: vi.fn()
}));

vi.mock("@/components/workflow-create-wizard/bootstrap", async () => {
  const actual = await vi.importActual<typeof import("@/components/workflow-create-wizard/bootstrap")>(
    "@/components/workflow-create-wizard/bootstrap"
  );

  return {
    ...actual,
    loadWorkflowCreateWizardBootstrap: vi.fn()
  };
});

vi.mock("@/lib/workspace-starter-governance-query", () => ({
  hasScopedWorkspaceStarterGovernanceFilters: vi.fn(() => false),
  pickWorkspaceStarterGovernanceQueryScope: vi.fn((viewState) => ({
    activeTrack: viewState.activeTrack,
    sourceGovernanceKind: viewState.sourceGovernanceKind,
    needsFollowUp: viewState.needsFollowUp,
    searchQuery: viewState.searchQuery,
    selectedTemplateId: viewState.selectedTemplateId,
    kind: "all"
  })),
  readWorkspaceStarterLibraryViewState: vi.fn(() => ({
    activeTrack: "all",
    archiveFilter: "active",
    searchQuery: "",
    sourceGovernanceKind: "all",
    needsFollowUp: false,
    selectedTemplateId: null
  }))
}));

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(loadWorkflowCreateWizardBootstrap).mockResolvedValue({
    catalogToolCount: 1,
    governanceQueryScope: {
      activeTrack: "all",
      sourceGovernanceKind: "all",
      needsFollowUp: false,
      searchQuery: "",
      selectedTemplateId: null
    },
    workflows: [{ id: "workflow-1" }],
    starters: [{ id: "starter-1" }],
    starterSourceLanes: [],
    nodeCatalog: [],
    tools: []
  } as unknown as Awaited<ReturnType<typeof loadWorkflowCreateWizardBootstrap>>);
});

describe("NewWorkflowPage", () => {
  it("renders the create bootstrap entry inside the workspace shell", async () => {
    vi.mocked(getServerWorkspaceContext).mockResolvedValue({
      workspace: {
        id: "default",
        name: "7Flows Workspace",
        slug: "sevenflows"
      },
      current_user: {
        id: "user-admin",
        email: "admin@taichuy.com",
        display_name: "7Flows Admin",
        status: "active",
        last_login_at: "2026-03-28T09:00:00Z"
      },
      current_member: {
        id: "member-owner",
        role: "owner",
        user: {
          id: "user-admin",
          email: "admin@taichuy.com",
          display_name: "7Flows Admin",
          status: "active",
          last_login_at: "2026-03-28T09:00:00Z"
        },
        created_at: "2026-03-27T12:00:00Z",
        updated_at: "2026-03-27T12:00:00Z"
      },
      available_roles: ["owner", "admin", "editor", "viewer"],
      can_manage_members: true
    });

    const html = renderToStaticMarkup(
      await NewWorkflowPage({
        searchParams: Promise.resolve({})
      })
    );

    expect(html).toContain('data-component="workspace-shell"');
    expect(html).toContain('data-component="workflow-create-wizard-entry"');
    expect(html).toContain('data-has-initial-bootstrap="true"');
    expect(html).toContain('data-bootstrap-starters-count="1"');
    expect(html).toContain('data-bootstrap-workflows-count="1"');
    expect(html).toContain('data-loads-legacy-auth="false"');
    expect(html).toContain('data-include-starter-definitions="true"');
    expect(html).toContain('data-include-builtin-starters="true"');
    expect(vi.mocked(loadWorkflowCreateWizardBootstrap)).toHaveBeenCalledTimes(1);
  });

  it("marks legacy auth bootstrap only when a scoped starter is requested", async () => {
    vi.mocked(getServerWorkspaceContext).mockResolvedValue({
      workspace: {
        id: "default",
        name: "7Flows Workspace",
        slug: "sevenflows"
      },
      current_user: {
        id: "user-admin",
        email: "admin@taichuy.com",
        display_name: "7Flows Admin",
        status: "active",
        last_login_at: "2026-03-28T09:00:00Z"
      },
      current_member: {
        id: "member-owner",
        role: "owner",
        user: {
          id: "user-admin",
          email: "admin@taichuy.com",
          display_name: "7Flows Admin",
          status: "active",
          last_login_at: "2026-03-28T09:00:00Z"
        },
        created_at: "2026-03-27T12:00:00Z",
        updated_at: "2026-03-27T12:00:00Z"
      },
      available_roles: ["owner", "admin", "editor", "viewer"],
      can_manage_members: true
    });
    const { readWorkspaceStarterLibraryViewState } = await import(
      "@/lib/workspace-starter-governance-query"
    );

    vi.mocked(readWorkspaceStarterLibraryViewState).mockReturnValue({
      activeTrack: "all",
      archiveFilter: "active",
      searchQuery: "",
      sourceGovernanceKind: "all",
      needsFollowUp: false,
      selectedTemplateId: "starter-workspace-1"
    });

    const html = renderToStaticMarkup(
      await NewWorkflowPage({
      searchParams: Promise.resolve({ starter: "starter-workspace-1" })
      })
    );

    expect(html).toContain('data-loads-legacy-auth="true"');
    expect(html).toContain('data-include-builtin-starters="true"');
    expect(html).toContain('data-has-initial-bootstrap="true"');
  });

  it("redirects unauthenticated users back to login", async () => {
    vi.mocked(getServerWorkspaceContext).mockResolvedValue(null);

    await expect(
      NewWorkflowPage({
        searchParams: Promise.resolve({})
      })
    ).rejects.toThrowError("redirect:/login?next=/workflows/new");
  });
});
