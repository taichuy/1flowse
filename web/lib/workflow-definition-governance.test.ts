import { describe, expect, it } from "vitest";

import {
  getWorkflowLegacyPublishAuthIssues,
  hasOnlyLegacyPublishAuthModeIssues,
  hasWorkflowLegacyPublishAuthIssues,
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
});
