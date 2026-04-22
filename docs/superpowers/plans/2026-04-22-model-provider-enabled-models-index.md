# Model Provider Enabled Models Plan Index

> **For agentic workers:** Read this index before executing any enabled-models plan. It maps the approved spec into a dependency-aware execution order and fixes the shared scope rules up front.

**Goal:** Turn the approved `enabled_model_ids + candidate cache` design into an execution map that can be implemented in ordered, testable slices without reintroducing the old single-model validation semantics.

**Architecture:** Treat this feature as three dependent tracks: backend contract and persistence first, settings UI second, downstream consumers plus regression last. Keep the data truth on the instance itself, keep candidate cache instance-scoped and manually refreshed, and make every consumer read only `enabled_model_ids`.

**Tech Stack:** Markdown planning docs only.

---

## Approved Design Source

Execute these plans against the approved spec:

1. [2026-04-22-model-provider-enabled-models-design.md](../specs/1flowbase/2026-04-22-model-provider-enabled-models-design.md)

## New Execution Plans

1. [2026-04-22-model-provider-enabled-models-backend-and-runtime.md](./2026-04-22-model-provider-enabled-models-backend-and-runtime.md)
   Replaces `validation_model_id` with `enabled_model_ids` in domain, service, storage, API route, runtime selection, and backend tests.
2. [2026-04-22-model-provider-enabled-models-settings-ui.md](./2026-04-22-model-provider-enabled-models-settings-ui.md)
   Reworks the settings page, API client types, and model-provider management UI to edit an enabled-model list plus candidate cache.
3. [2026-04-22-model-provider-enabled-models-consumers-and-regression.md](./2026-04-22-model-provider-enabled-models-consumers-and-regression.md)
   Aligns downstream consumers and shared fixtures, then closes the work with focused regression and plan updates.

## Recommended Execution Order

### Phase 1: Backend Contract Root

1. `2026-04-22-model-provider-enabled-models-backend-and-runtime.md`

Run this first. The UI and downstream consumers must not start until the backend contract is stable because both the settings page and agent-flow consumers read the same instance/options payload shape.

### Phase 2: Settings Management Surface

2. `2026-04-22-model-provider-enabled-models-settings-ui.md`

This depends on the backend contract landing first. It changes request/response DTOs, settings-page state wiring, and the operator workflow for candidate cache refresh plus enabled-model editing.

### Phase 3: Shared Consumers And Regression

3. `2026-04-22-model-provider-enabled-models-consumers-and-regression.md`

This runs last because it assumes both the backend response shape and the settings-page editing flow are already in place.

## Shared Scope Rules

These rules apply to every execution plan in this set:

1. Do not preserve `validation_model_id` as a product-level truth. Replace it with `enabled_model_ids`.
2. Do not add compatibility reads, fallback writes, or migration shims for old instances. The user will delete any existing development instances directly in PostgreSQL.
3. Keep candidate cache instance-scoped and persistent. Only refresh it when the user explicitly requests a fetch/refresh action.
4. `preview_token` only means “reuse this just-fetched candidate cache during save”. It no longer represents selecting one validated model.
5. Refresh failures must not delete or rewrite `enabled_model_ids`.
6. Downstream selectors and runtime choices must read only `enabled_model_ids`.

## Shared Status Rules

These status rules should be applied consistently across the execution plans:

1. `disabled` remains reserved for disabled/unavailable installation states and explicit disable flows that already exist.
2. `draft` means the instance currently has no `enabled_model_ids`.
3. `ready` means the instance has at least one `enabled_model_id`.
4. Candidate-cache refresh failures should be expressed through `catalog_refresh_status` and `catalog_last_error_message`, not by moving the instance into `invalid`.
5. Do not spend this feature removing every legacy `invalid` enum/reference unless the compiler or tests force that cleanup. Keep the execution focused on the enabled-model contract.

## Dependency Notes

- The backend plan owns the new storage migration file and the removal of validation-specific DTO fields from API responses.
- The settings UI plan owns the operator-facing wording changes, including replacing “校验模型 / 验证实例” language with “候选模型 / 生效模型 / 刷新候选模型”.
- The consumer/regression plan owns any fallout in `agent-flow`, style-boundary, and shared contract fixtures, plus the final focused verification set.
