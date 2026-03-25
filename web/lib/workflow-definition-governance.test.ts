import { describe, expect, it } from "vitest";

import {
  formatWorkflowMissingToolSummary,
  getWorkflowLegacyPublishAuthIssues,
  getWorkflowMissingToolIds,
  hasOnlyLegacyPublishAuthModeIssues,
  hasWorkflowLegacyPublishAuthIssues,
  hasWorkflowMissingToolIssues,
  isLegacyPublishAuthModeIssue
} from "@/lib/workflow-definition-governance";

describe("workflow-definition-governance", () => {
  it("recognizes publish auth blockers from workflow definition issues", () => {
    const issue = {
      category: "publish_draft",
      message: "Public Search 当前不能使用 authMode = token。",
      path: "publish.0.authMode",
      field: "authMode"
    };

    expect(isLegacyPublishAuthModeIssue(issue)).toBe(true);
    expect(
      getWorkflowLegacyPublishAuthIssues({
        definition_issues: [
          issue,
          {
            category: "tool_reference",
            message: "Missing tool",
            path: "nodes.0.config.toolId",
            field: "toolId"
          }
        ]
      })
    ).toEqual([issue]);
    expect(hasWorkflowLegacyPublishAuthIssues({ definition_issues: [issue] })).toBe(true);
    expect(hasOnlyLegacyPublishAuthModeIssues([issue])).toBe(true);
  });

  it("ignores non publish auth definition issues", () => {
    expect(
      hasWorkflowLegacyPublishAuthIssues({
        definition_issues: [
          {
            category: "publish_draft",
            message: "Endpoint name is missing.",
            path: "publish.0.name",
            field: "name"
          }
        ]
      })
    ).toBe(false);
    expect(
      hasOnlyLegacyPublishAuthModeIssues([
        {
          category: "publish_draft",
          message: "Endpoint name is missing.",
          path: "publish.0.name",
          field: "name"
        }
      ])
    ).toBe(false);
  });

  it("normalizes workflow missing tool ids into a shared catalog-gap summary", () => {
    const workflow = {
      tool_governance: {
        referenced_tool_ids: ["native.catalog-gap", "native.second-gap", "native.third-gap"],
        missing_tool_ids: [
          " native.catalog-gap ",
          "native.second-gap",
          "native.catalog-gap",
          "native.third-gap",
          ""
        ],
        governed_tool_count: 2,
        strong_isolation_tool_count: 1
      }
    };

    expect(getWorkflowMissingToolIds(workflow)).toEqual([
      "native.catalog-gap",
      "native.second-gap",
      "native.third-gap"
    ]);
    expect(hasWorkflowMissingToolIssues(workflow)).toBe(true);
    expect(formatWorkflowMissingToolSummary(workflow)).toBe(
      "catalog gap · native.catalog-gap、native.second-gap 等 3 个 tool"
    );
    expect(formatWorkflowMissingToolSummary(workflow, 3)).toBe(
      "catalog gap · native.catalog-gap、native.second-gap、native.third-gap"
    );
  });
});
