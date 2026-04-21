# LLM Provider Stable Binding And Provider Delete Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebind `LLM` nodes from `provider_instance_id` to stable `provider_code + model_id`, make runtime resolve the current effective provider instance per workspace, and add destructive provider-family delete from `/settings/model-providers`.

**Architecture:** Treat provider instances as runtime carrier config, not node identity. Frontend authoring, document validation, API options, compile/runtime resolution, and delete flows all converge on `provider_code + model_id`. Provider-family delete removes current-workspace instances and uninstalls the provider family through plugin management, while surfacing explicit failure states when runtime dependencies are missing.

**Tech Stack:** React, TanStack Query, Ant Design, TypeScript, Rust, Axum, control-plane services, PostgreSQL repositories, Vitest, Rust unit/route tests

---

## File Map

- Modify: `web/app/src/features/agent-flow/lib/llm-node-config.ts`
- Modify: `web/app/src/features/agent-flow/lib/model-options.ts`
- Modify: `web/app/src/features/agent-flow/components/detail/fields/LlmModelField.tsx`
- Modify: `web/app/src/features/agent-flow/components/detail/fields/LlmParameterForm.tsx`
- Modify: `web/app/src/features/agent-flow/lib/validate-document.ts`
- Modify: `web/app/src/features/agent-flow/schema/agent-flow-view-renderers.tsx`
- Modify: `web/app/src/features/agent-flow/components/inspector/NodeInspector.tsx`
- Modify: `web/app/src/features/agent-flow/lib/document/node-factory.ts`
- Modify: `web/app/src/features/settings/components/model-providers/ModelProviderCatalogPanel.tsx`
- Modify: `web/app/src/features/settings/pages/SettingsPage.tsx`
- Modify: `web/app/src/features/settings/api/plugins.ts`
- Modify: `web/packages/api-client/src/console-model-providers.ts`
- Modify: `web/packages/api-client/src/console-plugins.ts`
- Modify: `api/apps/api-server/src/routes/model_providers.rs`
- Modify: `api/apps/api-server/src/routes/plugins.rs`
- Modify: `api/crates/control-plane/src/model_provider.rs`
- Modify: `api/crates/control-plane/src/plugin_management.rs`
- Modify: `api/crates/control-plane/src/orchestration_runtime.rs`
- Modify: `api/crates/control-plane/src/ports.rs`
- Modify: `api/crates/storage-pg/src/plugin_repository.rs`
- Test: `web/app/src/features/agent-flow/_tests/llm-model-provider-field.test.tsx`
- Test: `web/app/src/features/agent-flow/_tests/validate-document.test.ts`
- Test: `web/app/src/features/agent-flow/_tests/node-schema-registry.test.tsx`
- Test: `web/app/src/features/settings/_tests/model-providers-page.test.tsx`
- Test: `api/apps/api-server/src/_tests/model_provider_routes.rs`
- Test: `api/apps/api-server/src/_tests/plugin_routes.rs`
- Test: `api/apps/api-server/src/_tests/application_runtime_routes.rs`
- Test: `api/crates/control-plane/src/_tests/plugin_management_service_tests.rs`
- Test: `api/crates/control-plane/src/_tests/model_provider_service_tests.rs`
- Test: `api/crates/control-plane/src/_tests/orchestration_runtime.rs` or existing inline tests in `api/crates/control-plane/src/orchestration_runtime.rs`

### Task 1: Rebind LLM Authoring Config To Stable Provider Identity

**Files:**
- Modify: `web/app/src/features/agent-flow/lib/llm-node-config.ts`
- Modify: `web/app/src/features/agent-flow/lib/model-options.ts`
- Modify: `web/app/src/features/agent-flow/components/detail/fields/LlmModelField.tsx`
- Modify: `web/app/src/features/agent-flow/lib/document/node-factory.ts`
- Test: `web/app/src/features/agent-flow/_tests/node-schema-registry.test.tsx`
- Test: `web/app/src/features/agent-flow/_tests/llm-model-provider-field.test.tsx`

- [x] Write failing frontend tests that expect `config.model_provider` to store `provider_code` and `model_id`, and that selecting a provider/model no longer writes `provider_instance_id`.
- [x] Run: `pnpm --dir web/app test -- --run web/app/src/features/agent-flow/_tests/node-schema-registry.test.tsx web/app/src/features/agent-flow/_tests/llm-model-provider-field.test.tsx`
- [x] Update node config parsing, default node factory state, option mapping helpers, and selector UI to use provider-family options keyed by `provider_code`.
- [x] Re-run the same frontend tests until green.

### Task 2: Change Provider Options And Validation To Resolve By Provider Code

**Files:**
- Modify: `web/packages/api-client/src/console-model-providers.ts`
- Modify: `api/apps/api-server/src/routes/model_providers.rs`
- Modify: `api/crates/control-plane/src/model_provider.rs`
- Modify: `web/app/src/features/agent-flow/lib/validate-document.ts`
- Modify: `web/app/src/features/agent-flow/components/detail/fields/LlmParameterForm.tsx`
- Test: `api/apps/api-server/src/_tests/model_provider_routes.rs`
- Test: `web/app/src/features/agent-flow/_tests/validate-document.test.ts`

- [x] Write failing route and frontend validation tests that expect provider options to be grouped by `provider_code`, expose the current effective instance for runtime use, and validate nodes by provider family plus model availability.
- [x] Run: `cargo test -p api-server model_provider_routes -- --nocapture`
- [x] Run: `pnpm --dir web/app test -- --run web/app/src/features/agent-flow/_tests/validate-document.test.ts`
- [x] Change the model-provider options view/response to publish one ready option per provider code, backed by the current effective instance for that workspace.
- [x] Update frontend validation and parameter-form lookup to resolve the selected provider by `provider_code`.
- [x] Re-run both targeted suites until green.

### Task 3: Switch Compile And Runtime Resolution From Instance Id To Provider Code

**Files:**
- Modify: `api/crates/control-plane/src/orchestration_runtime.rs`
- Modify: `web/app/src/features/agent-flow/schema/agent-flow-view-renderers.tsx`
- Modify: `web/app/src/features/agent-flow/components/inspector/NodeInspector.tsx`
- Test: `api/apps/api-server/src/_tests/application_runtime_routes.rs`
- Test: `api/crates/control-plane/src/orchestration_runtime.rs`

- [x] Write failing runtime tests that seed flow documents with `provider_code + model` and expect compile/runtime errors to map to provider-family availability instead of missing instance ids.
- [x] Run: `cargo test -p control-plane orchestration_runtime -- --nocapture`
- [x] Run: `cargo test -p api-server application_runtime_routes -- --nocapture`
- [x] Update compile input assembly, runnable checks, flow fixtures, and provider invocation resolution so runtime finds the current effective ready instance by `provider_code`.
- [x] Update node summary/inspector rendering to display provider label/code instead of instance id fallback.
- [x] Re-run runtime suites until green.

### Task 4: Add Destructive Provider-Family Delete To Plugin Management

**Files:**
- Modify: `api/crates/control-plane/src/ports.rs`
- Modify: `api/crates/storage-pg/src/plugin_repository.rs`
- Modify: `api/crates/control-plane/src/plugin_management.rs`
- Modify: `api/apps/api-server/src/routes/plugins.rs`
- Modify: `web/packages/api-client/src/console-plugins.ts`
- Modify: `web/app/src/features/settings/api/plugins.ts`
- Modify: `web/app/src/features/settings/components/model-providers/ModelProviderCatalogPanel.tsx`
- Modify: `web/app/src/features/settings/pages/SettingsPage.tsx`
- Test: `api/crates/control-plane/src/_tests/plugin_management_service_tests.rs`
- Test: `api/apps/api-server/src/_tests/plugin_routes.rs`
- Test: `web/app/src/features/settings/_tests/model-providers-page.test.tsx`

- [x] Write failing service, route, and page tests for provider-family delete: destructive confirm path, referenced-flow warning path, and successful cleanup path.
- [x] Run: `cargo test -p control-plane plugin_management_service_tests -- --nocapture`
- [x] Run: `cargo test -p api-server plugin_routes -- --nocapture`
- [x] Run: `pnpm --dir web/app test -- --run web/app/src/features/settings/_tests/model-providers-page.test.tsx`
- [x] Add plugin repository delete helpers for assignments/installations by provider code, then implement a plugin-management uninstall task that deletes current-workspace provider instances, clears assignment, removes installation records, and deletes artifact/package directories.
- [x] Expose a provider-family delete route under plugin management and wire the settings page to show destructive confirmation with referenced-flow warning text.
- [x] Re-run the three targeted suites until green.

### Task 5: Reconcile Residual Tests And Verify End-To-End Contracts

**Files:**
- Modify: any remaining affected tests from `web/app/src/features/agent-flow/_tests`, `api/apps/api-server/src/_tests`, and `api/crates/control-plane/src/_tests`
- Test: targeted frontend and backend suites above

- [x] Fix residual test fixtures that still build `provider_instance_id`-based node documents.
- [x] Run: `pnpm --dir web/app test -- --run web/app/src/features/agent-flow/_tests/llm-model-provider-field.test.tsx web/app/src/features/agent-flow/_tests/validate-document.test.ts web/app/src/features/agent-flow/_tests/node-schema-registry.test.tsx web/app/src/features/settings/_tests/model-providers-page.test.tsx`
- [x] Run: `cargo test -p control-plane plugin_management_service_tests model_provider_service_tests orchestration_runtime -- --nocapture`
- [x] Run: `cargo test -p api-server model_provider_routes plugin_routes application_runtime_routes -- --nocapture`
- [x] Update this plan file to mark completed tasks and note any intentional follow-up gaps.

## Follow-Up Notes

- `agent-flow-node-card.test.tsx` still emits an Ant Design `Tooltip overlayInnerStyle` deprecation warning from existing code. It does not block this change, but should be cleaned up separately when that component is touched next.
