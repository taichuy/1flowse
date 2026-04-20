# Plugin Architecture Follow-up Plan Index

> **For agentic workers:** Read this index before executing any plugin follow-up plan. It maps already-written plans and the new split plans into one dependency-aware sequence.

**Goal:** Give the plugin architecture work a single execution map so the already-written provider lifecycle plans and the newly split follow-up plans can be executed in the right order.

**Architecture:** Treat the current provider-plugin line as the first productionized slice, not the whole plugin system. Keep already-written plans as fixed foundation tracks, then split the remaining architecture into four independent follow-up plans: `plugin manifest v1`, `node contribution registry + block selector`, `capability plugin process_per_call execution`, and `host_extension restart-time loader`.

**Tech Stack:** Markdown planning docs only.

---

## Existing Foundation Plans

These plans already exist and must stay in the execution graph:

1. [2026-04-19-rust-provider-plugin-runtime-distribution.md](./2026-04-19-rust-provider-plugin-runtime-distribution.md)
   Covers executable package layout, `plugin-runner` provider loading, host packaging, and the first Rust provider example.
2. [2026-04-19-official-plugin-registry-latest-only.md](./2026-04-19-official-plugin-registry-latest-only.md)
   Normalizes official registry reads to one latest entry per provider family.
3. [2026-04-19-plugin-trust-source-install.md](./2026-04-19-plugin-trust-source-install.md)
   Defines source/trust semantics, upload intake, signature verification, and install provenance.
4. [2026-04-19-plugin-version-switch.md](./2026-04-19-plugin-version-switch.md)
   Adds family-level version switching and assignment-based current version pointers.
5. [2026-04-20-model-provider-contract-gate-implementation.md](./2026-04-20-model-provider-contract-gate-implementation.md)
   Keeps current model-provider browser and API consumers pinned to one shared contract shape.
6. [2026-04-20-plugin-derived-availability-and-reconcile.md](./2026-04-20-plugin-derived-availability-and-reconcile.md)
   Upgrades provider lifecycle to `desired_state / artifact_status / runtime_status / availability_status` and aligns the sibling official repo taxonomy.

## New Follow-up Plans

These are the newly split plans for the remaining architecture:

1. [2026-04-21-plugin-manifest-v1-and-package-contract.md](./2026-04-21-plugin-manifest-v1-and-package-contract.md)
   Unifies generic plugin metadata, `consumption_kind`, `execution_mode`, permissions, runtime entry, and `node_contributions[]` under one package contract.
2. [2026-04-21-node-contribution-registry-and-block-selector.md](./2026-04-21-node-contribution-registry-and-block-selector.md)
   Adds `node_contribution_registry`, dependency status resolution, DSL identity fields, and a registry-driven block selector.
3. [2026-04-21-capability-plugin-process-per-call-execution.md](./2026-04-21-capability-plugin-process-per-call-execution.md)
   Wires `CapabilityPlugin` execution through `plugin-runner` with `process_per_call` and worker lease tracking.
4. [2026-04-21-host-extension-loader-and-restart-activation.md](./2026-04-21-host-extension-loader-and-restart-activation.md)
   Closes the `HostExtension` path around `filesystem_dropin`, uploaded `pending_restart`, startup reconcile, and restart-time activation.

## Recommended Execution Order

### Phase 1: Provider Foundation

Run these first because the new plans assume they exist:

1. `2026-04-19-rust-provider-plugin-runtime-distribution.md`
2. `2026-04-19-official-plugin-registry-latest-only.md`
3. `2026-04-19-plugin-trust-source-install.md`
4. `2026-04-19-plugin-version-switch.md`
5. `2026-04-20-model-provider-contract-gate-implementation.md`
6. `2026-04-20-plugin-derived-availability-and-reconcile.md`

### Phase 2: Generic Plugin Contract

7. `2026-04-21-plugin-manifest-v1-and-package-contract.md`

This is the schema baseline for the remaining three plans. Do not start the node-contribution, capability-execution, or host-extension tracks before the manifest contract is stable.

### Phase 3: Canvas Capability Read Path

8. `2026-04-21-node-contribution-registry-and-block-selector.md`

This gives the host a registry, dependency resolution, and DSL identity shape before any third-party node executes.

### Phase 4: Canvas Capability Execute Path

9. `2026-04-21-capability-plugin-process-per-call-execution.md`

This depends on both the manifest plan and the node-contribution registry plan.

### Phase 5: Host-level Privileged Path

10. `2026-04-21-host-extension-loader-and-restart-activation.md`

This also depends on the manifest plan, but it is intentionally separate from the canvas capability path because it has different trust, activation, and process-boundary rules.

## Dependency Notes

- `plugin manifest v1` is the contract root for every remaining architecture track.
- `node contribution registry + block selector` should land before `CapabilityPlugin execute`, otherwise the host can run a plugin node that the DSL and selector cannot identify consistently.
- `host_extension` should not be merged into the capability plans. It has different source rules (`filesystem_dropin` / `root uploaded`), different activation timing (`pending_restart`), and different loading surface (startup only).
- The sibling repo `../1flowbase-official-plugins` remains part of the execution graph because runtime-extension examples and future capability examples need to stay aligned with the host contract.

