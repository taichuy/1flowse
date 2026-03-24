import { DEFAULT_LEGACY_PUBLISH_AUTH_MODE_CONTRACT } from "@/lib/legacy-publish-auth-contract";
import type {
  WorkflowPublishedEndpointIssue,
  WorkflowPublishedEndpointLegacyAuthGovernanceBindingItem,
  WorkflowPublishedEndpointLegacyAuthGovernanceSnapshot,
  WorkflowPublishedEndpointLegacyAuthGovernanceWorkflowItem,
  WorkflowPublishedEndpointLegacyAuthModeContract,
} from "@/lib/workflow-publish-types";

type LegacyAuthModeContractOverrides = Partial<WorkflowPublishedEndpointLegacyAuthModeContract>;

type LegacyAuthIssueOverrides = Omit<Partial<WorkflowPublishedEndpointIssue>, "auth_mode_contract"> & {
  auth_mode_contract?: LegacyAuthModeContractOverrides | null;
};

export function buildLegacyPublishAuthModeContractFixture(
  overrides: LegacyAuthModeContractOverrides = {}
): WorkflowPublishedEndpointLegacyAuthModeContract {
  return {
    supported_auth_modes: overrides.supported_auth_modes
      ? [...overrides.supported_auth_modes]
      : [...DEFAULT_LEGACY_PUBLISH_AUTH_MODE_CONTRACT.supported_auth_modes],
    retired_legacy_auth_modes: overrides.retired_legacy_auth_modes
      ? [...overrides.retired_legacy_auth_modes]
      : [...DEFAULT_LEGACY_PUBLISH_AUTH_MODE_CONTRACT.retired_legacy_auth_modes],
    summary: overrides.summary ?? DEFAULT_LEGACY_PUBLISH_AUTH_MODE_CONTRACT.summary,
    follow_up: overrides.follow_up ?? DEFAULT_LEGACY_PUBLISH_AUTH_MODE_CONTRACT.follow_up,
  };
}

export function buildLegacyPublishUnsupportedAuthIssueFixture(
  overrides: LegacyAuthIssueOverrides = {}
): WorkflowPublishedEndpointIssue {
  const { auth_mode_contract: authModeContractOverride, ...restOverrides } = overrides;
  const authModeContract =
    authModeContractOverride === null
      ? null
      : buildLegacyPublishAuthModeContractFixture(authModeContractOverride ?? undefined);

  return {
    category: "unsupported_auth_mode",
    message: "Legacy token auth is still persisted on this binding.",
    field: "auth_mode",
    remediation: "Switch back to api_key or internal before publishing.",
    blocks_lifecycle_publish: true,
    ...restOverrides,
    auth_mode_contract: authModeContract,
  };
}

export function buildLegacyAuthGovernanceBindingFixture(
  overrides: Partial<WorkflowPublishedEndpointLegacyAuthGovernanceBindingItem> = {}
): WorkflowPublishedEndpointLegacyAuthGovernanceBindingItem {
  return {
    workflow_id: "workflow-legacy-auth",
    workflow_name: "Legacy Auth workflow",
    binding_id: "binding-live",
    endpoint_id: "native-chat",
    endpoint_name: "Native Chat",
    workflow_version: "1.0.0",
    lifecycle_status: "published",
    auth_mode: "token",
    ...overrides,
  };
}

export function buildLegacyAuthGovernanceWorkflowFixture(
  overrides: Partial<WorkflowPublishedEndpointLegacyAuthGovernanceWorkflowItem> = {}
): WorkflowPublishedEndpointLegacyAuthGovernanceWorkflowItem {
  return {
    workflow_id: "workflow-legacy-auth",
    workflow_name: "Legacy Auth workflow",
    binding_count: 1,
    draft_candidate_count: 0,
    published_blocker_count: 1,
    offline_inventory_count: 0,
    ...overrides,
  };
}

export function buildLegacyAuthGovernanceSnapshotFixture(
  overrides: Partial<WorkflowPublishedEndpointLegacyAuthGovernanceSnapshot> = {}
): WorkflowPublishedEndpointLegacyAuthGovernanceSnapshot {
  const { auth_mode_contract: authModeContractOverride, ...restOverrides } = overrides;

  return {
    generated_at: "2026-03-24T08:00:00Z",
    workflow_count: 0,
    binding_count: 0,
    summary: {
      draft_candidate_count: 0,
      published_blocker_count: 0,
      offline_inventory_count: 0,
    },
    checklist: [],
    workflows: [],
    buckets: {
      draft_candidates: [],
      published_blockers: [],
      offline_inventory: [],
    },
    ...restOverrides,
    auth_mode_contract: authModeContractOverride
      ? buildLegacyPublishAuthModeContractFixture(authModeContractOverride)
      : buildLegacyPublishAuthModeContractFixture(),
  };
}
