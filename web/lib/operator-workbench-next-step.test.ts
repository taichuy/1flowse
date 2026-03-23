import { describe, expect, it } from "vitest";

import {
  buildRunLibraryRecommendedNextStep,
  buildSensitiveAccessInboxRecommendedNextStep
} from "@/lib/operator-workbench-next-step";

describe("operator workbench next step presenters", () => {
  it("prioritizes operator backlog on the run library page", () => {
    const recommendedNextStep = buildRunLibraryRecommendedNextStep({
      runtimeActivity: {
        summary: {
          recent_run_count: 1,
          recent_event_count: 1,
          run_statuses: { waiting_callback: 1 },
          event_types: { callback_waiting: 1 }
        },
        recent_runs: [
          {
            id: "run-1",
            workflow_id: "workflow-1",
            workflow_version: "1.0.0",
            status: "waiting_callback",
            created_at: "2026-03-23T00:00:00Z",
            finished_at: null,
            event_count: 1
          }
        ],
        recent_events: []
      },
      callbackWaitingAutomation: {
        status: "configured",
        scheduler_required: true,
        detail: "healthy",
        scheduler_health_status: "healthy",
        scheduler_health_detail: "healthy",
        steps: [],
        affected_run_count: 1,
        affected_workflow_count: 1,
        primary_blocker_kind: "scheduler_unhealthy",
        recommended_action: {
          kind: "scheduler_unhealthy",
          entry_key: "runLibrary",
          href: "/runs",
          label: "open run library"
        }
      },
      sandboxReadiness: null,
      sensitiveAccessSummary: {
        ticket_count: 2,
        pending_ticket_count: 2,
        approved_ticket_count: 0,
        rejected_ticket_count: 0,
        expired_ticket_count: 0,
        waiting_ticket_count: 0,
        resumed_ticket_count: 0,
        failed_ticket_count: 0,
        pending_notification_count: 0,
        delivered_notification_count: 0,
        failed_notification_count: 0
      },
      currentHref: "/runs"
    });

    expect(recommendedNextStep).toMatchObject({
      label: "pending approval ticket",
      href: "/sensitive-access?status=pending"
    });
  });

  it("re-homes callback recovery self-links to the latest waiting run", () => {
    const recommendedNextStep = buildRunLibraryRecommendedNextStep({
      runtimeActivity: {
        summary: {
          recent_run_count: 2,
          recent_event_count: 2,
          run_statuses: { waiting_callback: 1, completed: 1 },
          event_types: { callback_waiting: 1, node_completed: 1 }
        },
        recent_runs: [
          {
            id: "run-wait",
            workflow_id: "workflow-1",
            workflow_version: "1.0.0",
            status: "waiting_callback",
            created_at: "2026-03-23T00:00:00Z",
            finished_at: null,
            event_count: 1
          },
          {
            id: "run-done",
            workflow_id: "workflow-2",
            workflow_version: "1.0.0",
            status: "completed",
            created_at: "2026-03-22T00:00:00Z",
            finished_at: "2026-03-22T00:05:00Z",
            event_count: 1
          }
        ],
        recent_events: []
      },
      callbackWaitingAutomation: {
        status: "degraded",
        scheduler_required: true,
        detail: "scheduler unhealthy",
        scheduler_health_status: "failed",
        scheduler_health_detail: "scheduler unhealthy",
        steps: [],
        affected_run_count: 1,
        affected_workflow_count: 1,
        primary_blocker_kind: "scheduler_unhealthy",
        recommended_action: {
          kind: "scheduler_unhealthy",
          entry_key: "runLibrary",
          href: "/runs",
          label: "open run library"
        }
      },
      sandboxReadiness: null,
      sensitiveAccessSummary: {
        ticket_count: 0,
        pending_ticket_count: 0,
        approved_ticket_count: 0,
        rejected_ticket_count: 0,
        expired_ticket_count: 0,
        waiting_ticket_count: 0,
        resumed_ticket_count: 0,
        failed_ticket_count: 0,
        pending_notification_count: 0,
        delivered_notification_count: 0,
        failed_notification_count: 0
      },
      currentHref: "/runs"
    });

    expect(recommendedNextStep).toMatchObject({
      label: "callback recovery",
      href: "/runs/run-wait"
    });
  });

  it("projects the first actionable inbox entry into a ticket slice", () => {
    const recommendedNextStep = buildSensitiveAccessInboxRecommendedNextStep({
      entries: [
        {
          ticket: {
            id: "ticket-1",
            run_id: "run-1",
            node_run_id: "node-run-1",
            access_request_id: "request-1",
            status: "pending",
            waiting_status: "waiting",
            created_at: "2026-03-23T00:00:00Z",
            decided_at: null,
            expires_at: null,
            approved_by: null
          },
          request: {
            id: "request-1",
            run_id: "run-1",
            node_run_id: "node-run-1",
            requester_type: "workflow",
            requester_id: "workflow-1",
            resource_id: "resource-1",
            action_type: "read",
            decision: "require_approval",
            decision_label: "require approval",
            reason_code: "approval_required",
            reason_label: "approval required",
            policy_summary: null,
            created_at: "2026-03-23T00:00:00Z",
            decided_at: null,
            purpose_text: null
          },
          resource: {
            id: "resource-1",
            label: "Sandbox secret",
            description: null,
            sensitivity_level: "L2",
            source: "workflow_context",
            metadata: {},
            created_at: "2026-03-23T00:00:00Z",
            updated_at: "2026-03-23T00:00:00Z"
          },
          notifications: [],
          runSnapshot: null,
          runFollowUp: null,
          callbackWaitingContext: null,
          executionContext: null
        }
      ],
      summary: {
        ticket_count: 1,
        pending_ticket_count: 1,
        approved_ticket_count: 0,
        rejected_ticket_count: 0,
        expired_ticket_count: 0,
        waiting_ticket_count: 1,
        resumed_ticket_count: 0,
        failed_ticket_count: 0,
        pending_notification_count: 0,
        delivered_notification_count: 0,
        failed_notification_count: 0
      },
      callbackWaitingAutomation: null,
      sandboxReadiness: null,
      currentHref: "/sensitive-access"
    });

    expect(recommendedNextStep).toMatchObject({
      label: "approval blocker",
      href: "/sensitive-access?status=pending&waiting_status=waiting&run_id=run-1&node_run_id=node-run-1&access_request_id=request-1&approval_ticket_id=ticket-1"
    });
  });

  it("falls back to run detail when the current inbox page already matches the exact ticket slice", () => {
    const exactSliceHref =
      "/sensitive-access?status=pending&waiting_status=waiting&run_id=run-1&node_run_id=node-run-1&access_request_id=request-1&approval_ticket_id=ticket-1";
    const recommendedNextStep = buildSensitiveAccessInboxRecommendedNextStep({
      entries: [
        {
          ticket: {
            id: "ticket-1",
            run_id: "run-1",
            node_run_id: "node-run-1",
            access_request_id: "request-1",
            status: "pending",
            waiting_status: "waiting",
            created_at: "2026-03-23T00:00:00Z",
            decided_at: null,
            expires_at: null,
            approved_by: null
          },
          request: {
            id: "request-1",
            run_id: "run-1",
            node_run_id: "node-run-1",
            requester_type: "workflow",
            requester_id: "workflow-1",
            resource_id: "resource-1",
            action_type: "read",
            decision: "require_approval",
            decision_label: "require approval",
            reason_code: "approval_required",
            reason_label: "approval required",
            policy_summary: null,
            created_at: "2026-03-23T00:00:00Z",
            decided_at: null,
            purpose_text: null
          },
          resource: {
            id: "resource-1",
            label: "Sandbox secret",
            description: null,
            sensitivity_level: "L2",
            source: "workflow_context",
            metadata: {},
            created_at: "2026-03-23T00:00:00Z",
            updated_at: "2026-03-23T00:00:00Z"
          },
          notifications: [],
          runSnapshot: null,
          runFollowUp: null,
          callbackWaitingContext: null,
          executionContext: null
        }
      ],
      summary: {
        ticket_count: 1,
        pending_ticket_count: 1,
        approved_ticket_count: 0,
        rejected_ticket_count: 0,
        expired_ticket_count: 0,
        waiting_ticket_count: 1,
        resumed_ticket_count: 0,
        failed_ticket_count: 0,
        pending_notification_count: 0,
        delivered_notification_count: 0,
        failed_notification_count: 0
      },
      callbackWaitingAutomation: null,
      sandboxReadiness: null,
      currentHref: exactSliceHref
    });

    expect(recommendedNextStep).toMatchObject({
      label: "approval blocker",
      href: "/runs/run-1"
    });
  });
});
