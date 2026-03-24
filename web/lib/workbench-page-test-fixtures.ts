import { getSensitiveAccessInboxSnapshot } from "@/lib/get-sensitive-access";
import { getSystemOverview } from "@/lib/get-system-overview";

type SystemOverview = Awaited<ReturnType<typeof getSystemOverview>>;
type SensitiveAccessInboxSnapshot = Awaited<ReturnType<typeof getSensitiveAccessInboxSnapshot>>;
type SensitiveAccessInboxEntry = SensitiveAccessInboxSnapshot["entries"][number];
type SensitiveAccessTicket = SensitiveAccessInboxEntry["ticket"];
type SensitiveAccessRequest = NonNullable<SensitiveAccessInboxEntry["request"]>;
type SensitiveAccessResource = NonNullable<SensitiveAccessInboxEntry["resource"]>;
type SensitiveAccessExecutionContext = NonNullable<SensitiveAccessInboxEntry["executionContext"]>;
type SensitiveAccessExecutionFocusNode = SensitiveAccessExecutionContext["focusNode"];

type SystemOverviewFixtureOverrides = Omit<
  Partial<SystemOverview>,
  "sandbox_readiness" | "runtime_activity" | "callback_waiting_automation"
> & {
  sandbox_readiness?: Partial<SystemOverview["sandbox_readiness"]>;
  runtime_activity?: Partial<SystemOverview["runtime_activity"]> & {
    summary?: Partial<SystemOverview["runtime_activity"]["summary"]>;
  };
  callback_waiting_automation?: Partial<SystemOverview["callback_waiting_automation"]>;
};

type SensitiveAccessInboxSnapshotFixtureOverrides = Omit<
  Partial<SensitiveAccessInboxSnapshot>,
  "summary"
> & {
  summary?: Partial<SensitiveAccessInboxSnapshot["summary"]>;
};

export function buildSystemOverviewFixture(
  overrides: SystemOverviewFixtureOverrides = {}
): SystemOverview {
  const defaultSnapshot = {
    status: "ok",
    environment: "local",
    services: [],
    capabilities: [],
    plugin_adapters: [],
    sandbox_backends: [],
    sandbox_readiness: {
      enabled_backend_count: 0,
      healthy_backend_count: 0,
      degraded_backend_count: 0,
      offline_backend_count: 0,
      execution_classes: [],
      supported_languages: [],
      supported_profiles: [],
      supported_dependency_modes: [],
      supports_tool_execution: false,
      supports_builtin_package_sets: false,
      supports_backend_extensions: false,
      supports_network_policy: false,
      supports_filesystem_policy: false
    },
    plugin_tools: [],
    runtime_activity: {
      summary: {
        recent_run_count: 0,
        recent_event_count: 0,
        run_statuses: {},
        event_types: {}
      },
      recent_runs: [],
      recent_events: []
    },
    callback_waiting_automation: {
      status: "configured",
      scheduler_required: true,
      detail: "healthy",
      scheduler_health_status: "healthy",
      scheduler_health_detail: "healthy",
      steps: []
    }
  } satisfies SystemOverview;

  return {
    ...defaultSnapshot,
    ...overrides,
    services: overrides.services ?? defaultSnapshot.services,
    capabilities: overrides.capabilities ?? defaultSnapshot.capabilities,
    plugin_adapters: overrides.plugin_adapters ?? defaultSnapshot.plugin_adapters,
    sandbox_backends: overrides.sandbox_backends ?? defaultSnapshot.sandbox_backends,
    sandbox_readiness: {
      ...defaultSnapshot.sandbox_readiness,
      ...overrides.sandbox_readiness,
      execution_classes:
        overrides.sandbox_readiness?.execution_classes ??
        defaultSnapshot.sandbox_readiness.execution_classes,
      supported_languages:
        overrides.sandbox_readiness?.supported_languages ??
        defaultSnapshot.sandbox_readiness.supported_languages,
      supported_profiles:
        overrides.sandbox_readiness?.supported_profiles ??
        defaultSnapshot.sandbox_readiness.supported_profiles,
      supported_dependency_modes:
        overrides.sandbox_readiness?.supported_dependency_modes ??
        defaultSnapshot.sandbox_readiness.supported_dependency_modes
    },
    plugin_tools: overrides.plugin_tools ?? defaultSnapshot.plugin_tools,
    runtime_activity: {
      ...defaultSnapshot.runtime_activity,
      ...overrides.runtime_activity,
      summary: {
        ...defaultSnapshot.runtime_activity.summary,
        ...overrides.runtime_activity?.summary
      },
      recent_runs:
        overrides.runtime_activity?.recent_runs ?? defaultSnapshot.runtime_activity.recent_runs,
      recent_events:
        overrides.runtime_activity?.recent_events ?? defaultSnapshot.runtime_activity.recent_events
    },
    callback_waiting_automation: {
      ...defaultSnapshot.callback_waiting_automation,
      ...overrides.callback_waiting_automation,
      steps:
        overrides.callback_waiting_automation?.steps ??
        defaultSnapshot.callback_waiting_automation.steps
    }
  };
}

export function buildSensitiveAccessInboxSnapshotFixture(
  overrides: SensitiveAccessInboxSnapshotFixtureOverrides = {}
): SensitiveAccessInboxSnapshot {
  const defaultSnapshot = {
    channels: [],
    resources: [],
    requests: [],
    notifications: [],
    summary: {
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
    entries: []
  } satisfies SensitiveAccessInboxSnapshot;

  return {
    ...defaultSnapshot,
    ...overrides,
    channels: overrides.channels ?? defaultSnapshot.channels,
    resources: overrides.resources ?? defaultSnapshot.resources,
    requests: overrides.requests ?? defaultSnapshot.requests,
    notifications: overrides.notifications ?? defaultSnapshot.notifications,
    summary: {
      ...defaultSnapshot.summary,
      ...overrides.summary
    },
    entries: overrides.entries ?? defaultSnapshot.entries
  };
}

export function buildSensitiveAccessTicketFixture(
  overrides: Partial<SensitiveAccessTicket> = {}
): SensitiveAccessTicket {
  return {
    id: "ticket-1",
    access_request_id: "request-1",
    run_id: "run-1",
    node_run_id: "node-run-1",
    status: "pending",
    waiting_status: "waiting",
    created_at: "2026-03-24T08:00:00Z",
    decided_at: null,
    expires_at: null,
    approved_by: null,
    ...overrides
  };
}

export function buildSensitiveAccessRequestFixture(
  overrides: Partial<SensitiveAccessRequest> = {}
): SensitiveAccessRequest {
  return {
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
    created_at: "2026-03-24T08:00:00Z",
    decided_at: null,
    purpose_text: null,
    ...overrides
  };
}

export function buildSensitiveAccessResourceFixture(
  overrides: Partial<SensitiveAccessResource> = {}
): SensitiveAccessResource {
  return {
    id: "resource-1",
    label: "Sandbox secret",
    description: null,
    sensitivity_level: "L2",
    source: "workflow_context",
    metadata: {},
    created_at: "2026-03-24T08:00:00Z",
    updated_at: "2026-03-24T08:00:00Z",
    ...overrides
  };
}

export function buildSensitiveAccessExecutionFocusNodeFixture(
  overrides: Partial<SensitiveAccessExecutionFocusNode> = {}
): SensitiveAccessExecutionFocusNode {
  return {
    node_run_id: "node-run-1",
    node_id: "node-1",
    node_name: "Approval Node",
    node_type: "tool",
    waiting_reason: null,
    scheduled_resume_delay_seconds: null,
    scheduled_resume_due_at: null,
    callback_tickets: [],
    sensitive_access_entries: [],
    execution_fallback_count: 0,
    execution_blocked_count: 0,
    execution_unavailable_count: 0,
    execution_blocking_reason: null,
    execution_fallback_reason: null,
    artifact_refs: [],
    artifacts: [],
    tool_calls: [],
    ...overrides
  };
}

export function buildSensitiveAccessExecutionContextFixture(
  overrides: Partial<SensitiveAccessExecutionContext> = {}
): SensitiveAccessExecutionContext {
  return {
    runId: "run-1",
    focusNode: buildSensitiveAccessExecutionFocusNodeFixture(),
    focusReason: "current_node",
    focusExplanation: null,
    focusMatchesEntry: true,
    entryNodeRunId: "node-run-1",
    skillTrace: null,
    ...overrides
  };
}

export function buildSensitiveAccessInboxEntryFixture(
  overrides: Partial<SensitiveAccessInboxEntry> = {}
): SensitiveAccessInboxEntry {
  return {
    ticket: buildSensitiveAccessTicketFixture(),
    request: buildSensitiveAccessRequestFixture(),
    resource: buildSensitiveAccessResourceFixture(),
    notifications: [],
    runSnapshot: null,
    runFollowUp: null,
    legacyAuthGovernance: null,
    callbackWaitingContext: null,
    executionContext: null,
    ...overrides
  };
}
