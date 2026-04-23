# Model Provider Main Instance Aggregation Plan Index

> **For agentic workers:** Read this index before executing any main-instance aggregation plan. It maps the approved spec into a dependency-aware execution order and fixes the shared scope rules up front.

**Goal:** Turn the approved “virtual main instance aggregates child instances” design into an execution map that can be implemented in ordered, testable slices without preserving the old `manual_primary` contract.

**Architecture:** Treat this feature as three dependent tracks: backend contract and runtime first, settings management UI second, agent-flow consumers plus final regression last. Keep the main instance virtual and provider-scoped, keep execution bound to real child instances, and make every consumer read the same `provider_code + source_instance_id + model_id` truth.

**Tech Stack:** Markdown planning docs only.

---

## Approved Design Source

Execute these plans against the approved spec:

1. [2026-04-23-model-provider-main-instance-aggregation-design.md](../specs/2026-04-23-model-provider-main-instance-aggregation-design.md)

## New Execution Plans

1. [2026-04-23-model-provider-main-instance-aggregation-backend-and-runtime.md](./2026-04-23-model-provider-main-instance-aggregation-backend-and-runtime.md)
   Replaces `manual_primary` with provider-level aggregation settings, adds `included_in_main`, rewrites options payloads, and makes runtime resolve real child instances from node config.
2. [2026-04-23-model-provider-main-instance-aggregation-settings-ui.md](./2026-04-23-model-provider-main-instance-aggregation-settings-ui.md)
   Reworks settings API clients, instance drawer/modal state, and the operator workflow so the main instance becomes a fixed aggregation surface.
3. [2026-04-23-model-provider-main-instance-aggregation-agent-flow-and-regression.md](./2026-04-23-model-provider-main-instance-aggregation-agent-flow-and-regression.md)
   Updates agent-flow model-provider contracts, grouped selectors, document validation, focused regressions, and final QA closeout.

## Recommended Execution Order

### Phase 1: Backend Contract Root

1. `2026-04-23-model-provider-main-instance-aggregation-backend-and-runtime.md`

Run this first. The settings page and agent-flow selectors must not start until the backend contract is stable because both surfaces read the same provider-instance and options payload shapes.

### Phase 2: Settings Management Surface

2. `2026-04-23-model-provider-main-instance-aggregation-settings-ui.md`

This depends on the backend contract landing first. It changes settings request/response DTOs, modal state wiring, main-instance presentation, and the operator workflow for provider defaults plus per-instance inclusion.

### Phase 3: AgentFlow Consumers And Final Regression

3. `2026-04-23-model-provider-main-instance-aggregation-agent-flow-and-regression.md`

This runs last because it assumes both the backend options shape and the settings management workflow are already in place.

## Shared Scope Rules

These rules apply to every execution plan in this set:

1. Do not preserve `routing_mode = manual_primary` or `primary_instance_id` as product-level truth.
2. Do not add compatibility reads, fallback writes, migration shims, or dual-path UI text for the old primary-instance contract.
3. The main instance is always virtual and provider-scoped. It must never store secrets or become a real executable instance row.
4. Child instances join the main instance only through `included_in_main`; no per-model inclusion contract should be added in this feature.
5. New child-instance default behavior must be driven by provider-level `auto_include_new_instances`, but editing an existing child instance must keep its own explicit `included_in_main` value.
6. Agent-flow node config must end this feature with `provider_code + source_instance_id + model_id`.
7. If an existing node references an instance or model that is no longer aggregated, keep the stored value and fail validation/runtime explicitly instead of auto-repairing it.

## Shared Naming Rules

Use these names consistently across plans:

1. “主实例 / main instance” means the provider-level virtual aggregation surface.
2. “子实例 / child instance” means the real executable provider instance row with secrets and runtime config.
3. “加入主实例 / included in main” means the child instance contributes its enabled models to the main-instance grouped model view.
4. “来源实例 / source instance” means the concrete child instance selected by an LLM node.

## Dependency Notes

- The backend plan owns storage migrations, domain types, route DTO changes, options payload redesign, and runtime compile-context updates.
- The settings UI plan owns main-instance modal composition, provider default toggles, instance-level inclusion toggles, and removal of the old primary-instance selector.
- The agent-flow plan owns grouped model options, `source_instance_id` node config, editor/runtime validation fallout, and final `qa-evaluation` closeout.
