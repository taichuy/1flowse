import { describe, expect, it } from "vitest";

import { buildSensitiveAccessInboxEntryWorkflowGovernanceHandoff } from "./sensitive-access-inbox-workflow-governance";
import { buildLegacyAuthGovernanceSinglePublishedBlockerSnapshotFixture } from "./workflow-publish-legacy-auth-test-fixtures";
import {
  buildSensitiveAccessInboxEntryFixture,
  buildSensitiveAccessRequestFixture,
  buildSensitiveAccessTicketFixture
} from "./workbench-page-test-fixtures";

describe("sensitive access inbox workflow governance handoff", () => {
  it("preserves scoped workflow detail hrefs when provided by the caller", () => {
    const handoff = buildSensitiveAccessInboxEntryWorkflowGovernanceHandoff({
      entry: buildSensitiveAccessInboxEntryFixture({
        ticket: buildSensitiveAccessTicketFixture({
          run_id: "run-1",
          node_run_id: "node-run-1"
        }),
        request: buildSensitiveAccessRequestFixture({
          run_id: "run-1",
          node_run_id: "node-run-1"
        }),
        runSnapshot: {
          workflowId: "workflow-1"
        },
        runFollowUp: {
          affectedRunCount: 1,
          sampledRunCount: 1,
          waitingRunCount: 1,
          runningRunCount: 0,
          succeededRunCount: 0,
          failedRunCount: 0,
          unknownRunCount: 0,
          recommendedAction: null,
          sampledRuns: [
            {
              runId: "run-1",
              snapshot: {
                workflowId: "workflow-1"
              },
              callbackTickets: [],
              sensitiveAccessEntries: [],
              toolGovernance: {
                referenced_tool_ids: ["native.catalog-gap"],
                missing_tool_ids: ["native.catalog-gap"],
                governed_tool_count: 0,
                strong_isolation_tool_count: 0
              },
              legacyAuthGovernance:
                buildLegacyAuthGovernanceSinglePublishedBlockerSnapshotFixture({
                  binding: {
                    workflow_id: "workflow-1",
                    workflow_name: "Workflow 1"
                  }
                })
            }
          ]
        }
      }),
      resolveWorkflowDetailHref: (workflowId) =>
        `/workflows/${workflowId}?needs_follow_up=true&starter=starter-1&track=%E5%BA%94%E7%94%A8%E6%96%B0%E5%BB%BA%E7%BC%96%E6%8E%92`,
      subjectLabel: "operator backlog",
      returnDetail: "先回到 workflow 编辑器补齐 binding / publish auth contract。"
    });

    expect(handoff).toMatchObject({
      workflowId: "workflow-1",
      workflowCatalogGapHref:
        "/workflows/workflow-1?needs_follow_up=true&starter=starter-1&track=%E5%BA%94%E7%94%A8%E6%96%B0%E5%BB%BA%E7%BC%96%E6%8E%92&definition_issue=missing_tool",
      workflowGovernanceHref:
        "/workflows/workflow-1?needs_follow_up=true&starter=starter-1&track=%E5%BA%94%E7%94%A8%E6%96%B0%E5%BB%BA%E7%BC%96%E6%8E%92&definition_issue=legacy_publish_auth",
      workflowCatalogGapSummary: "catalog gap · native.catalog-gap"
    });
    expect(handoff.workflowCatalogGapDetail).toContain("operator backlog");
    expect(handoff.legacyAuthHandoff?.statusChipLabel).toBe("publish auth blocker");
  });
});
