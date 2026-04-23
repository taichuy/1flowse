# Model Provider Parameter And Context Plan Index

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the approved provider-level parameter schema and model-level context override design into an execution map that lands consistent host contracts, settings workflows, Agent Flow consumers, and an upgraded `openai_compatible` plugin package with verified packaging metadata.

**Architecture:** Execute this feature in four dependent slices. First, rewrite the host/backend contract so provider options expose a provider-level `parameter_form` and instance `configured_models` persist `context_window_override_tokens`. Second, update the settings drawer workflow to edit and validate model context overrides. Third, switch Agent Flow to provider-level parameter schema and effective context display. Fourth, upgrade the official `openai_compatible` plugin to emit the new schema and richer model metadata while keeping packaging versioning manifest-led, then close with focused QA.

**Tech Stack:** Markdown planning docs only.

---

## Approved Design Source

Execute these plans against the approved spec:

1. [2026-04-23-model-provider-parameter-schema-and-context-override-design.md](../specs/2026-04-23-model-provider-parameter-schema-and-context-override-design.md)

## New Execution Plans

1. [2026-04-23-model-provider-parameter-and-context-backend.md](./2026-04-23-model-provider-parameter-and-context-backend.md)
   Owns provider-package parsing, provider-level `parameter_form`, `configured_models[*].context_window_override_tokens`, route/client DTO changes, and contract fixtures.
2. [2026-04-23-model-provider-parameter-and-context-settings-ui.md](./2026-04-23-model-provider-parameter-and-context-settings-ui.md)
   Owns the settings drawer row model, strict context-input parsing and formatting, create/edit submit flows, and focused settings regressions.
3. [2026-04-23-model-provider-parameter-and-context-agent-flow.md](./2026-04-23-model-provider-parameter-and-context-agent-flow.md)
   Owns provider-level parameter-form consumption, effective context display in the model selector, and Agent Flow regression coverage.
4. [2026-04-23-openai-compatible-parameter-and-context-plugin.md](./2026-04-23-openai-compatible-parameter-and-context-plugin.md)
   Owns the sibling official-plugin repository changes: provider YAML schema, model metadata extraction, unit tests, and packaging metadata verification.

## Recommended Execution Order

### Phase 1: Host Contract Root

1. `2026-04-23-model-provider-parameter-and-context-backend.md`

Run this first. Both settings and Agent Flow need the same backend truth for provider-level parameter schema and model-level context overrides.

### Phase 2: Settings Management Workflow

2. `2026-04-23-model-provider-parameter-and-context-settings-ui.md`

Run this second. It depends on the new backend DTOs and persistence shape, and it is the only write surface for manual context overrides.

### Phase 3: Agent Flow Consumers

3. `2026-04-23-model-provider-parameter-and-context-agent-flow.md`

Run this third. It assumes the options payload and settings workflow are already stable.

### Phase 4: Official Plugin Upgrade

4. `2026-04-23-openai-compatible-parameter-and-context-plugin.md`

Run this after the host contract is merged or in a tightly coordinated branch. The plugin manifest version must align with the new provider-level schema contract before packaging and CI/CD validation, while `Cargo.toml` stays on the repo sentinel version.

## Shared Scope Rules

These rules apply to every plan in this set:

1. `parameter_form` belongs to the provider-level options entry, not to each individual model descriptor.
2. `context_window` and `max_output_tokens` remain model-level metadata.
3. Manual context fallback belongs to `configured_models[*]`, not to provider `config_json`.
4. Stored context override values must be pure numbers in tokens; `K/M` are display and input conveniences only.
5. Input parsing must normalize with `trim + toLowerCase`, accept only pure digits or `<number>k/<number>m`, and reject invalid values before persistence.
6. The host must not invent generic provider parameters or guess unknown context windows.
7. The `openai_compatible` plugin may extract metadata from explicit upstream fields only; if no field is present, return `null`.
8. This feature ships as a forward-only contract change; do not add compatibility shims, dual-path reads, or fallback writes for the old model-level `parameter_form`.

## Shared Naming Rules

Use these names consistently:

1. `parameter_form` means provider-level parameter schema returned by `/api/console/model-providers/options`.
2. `context_window_override_tokens` means the model-level manual context fallback stored inside `configured_models`.
3. “effective context window” means `context_window_override_tokens ?? model.context_window ?? null`.
4. “context size input” means the settings-drawer editable field that accepts pure digits or `k/m` suffixes and persists a number.

## Dependency Notes

- The backend plan owns `plugin-framework`, `control-plane`, `storage-pg`, `api-server`, `@1flowbase/api-client`, and contract-fixture alignment.
- The settings plan owns the only manual-edit workflow for `context_window_override_tokens`.
- The Agent Flow plan owns provider-level parameter-form consumption and read-only display of effective context metadata.
- The plugin plan owns the sibling repository `/home/taichu/git/1flowbase-official-plugins/runtime-extensions/model-providers/openai_compatible`.
