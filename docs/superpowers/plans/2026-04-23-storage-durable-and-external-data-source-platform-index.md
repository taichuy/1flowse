# Storage Durable And External Data Source Platform Plan Index

> **For agentic workers:** Read this index before executing any `storage-durable` or `data-source-platform` plan. It maps the approved spec into dependency-aware slices and fixes the scope rules before code changes begin.

**Goal:** Replace the implementation-named `storage-pg` boundary with `storage-durable + storage-postgres`, keep PostgreSQL as the only official durable backend in the main repo, and add a separate plugin-oriented `data-source-platform` path for future external database, SaaS, and API adapters.

**Architecture:** Execute this work in five ordered tracks. First, introduce the new durable boundary crate plus the renamed PostgreSQL implementation crate. Second, rewire API-server and docs onto the new durable names and delete the old crate. Third, add a dedicated data-source plugin contract and plugin-runner host instead of forcing external sources into the provider contract. Fourth, add `data-source-platform` domain, control-plane, PostgreSQL persistence, and API routes. Fifth, publish a concrete example plugin template, author guidance, and close the feature with focused regression plus QA.

**Tech Stack:** Markdown planning docs only.

---

## Approved Design Source

Execute these plans against the approved spec:

1. [2026-04-23-storage-durable-and-external-data-source-platform-design.md](../specs/2026-04-23-storage-durable-and-external-data-source-platform-design.md)

## New Execution Plans

1. [2026-04-23-storage-durable-boundary-and-storage-postgres-root.md](./2026-04-23-storage-durable-boundary-and-storage-postgres-root.md)
   Adds `storage-durable`, creates `storage-postgres`, and freezes the new main-storage public surface before consumers move.
2. [2026-04-23-storage-durable-consumer-rewire-and-cleanup.md](./2026-04-23-storage-durable-consumer-rewire-and-cleanup.md)
   Rewires API-server and related tests to the new durable boundary, then removes `storage-pg` and updates local docs and rules.
3. [2026-04-23-data-source-plugin-contract-and-runner.md](./2026-04-23-data-source-plugin-contract-and-runner.md)
   Adds `1flowbase.data_source/v1`, a dedicated plugin-framework package loader, and a `plugin-runner` host for data-source runtime calls.
4. [2026-04-23-data-source-platform-domain-and-api.md](./2026-04-23-data-source-platform-domain-and-api.md)
   Adds the new domain records, control-plane services and ports, PostgreSQL persistence, API-server runtime wiring, and console routes for data-source instances.
5. [2026-04-23-data-source-example-template-and-regression.md](./2026-04-23-data-source-example-template-and-regression.md)
   Publishes a concrete example data-source plugin template, adds author guidance, and closes the entire slice with focused regression plus `qa-evaluation`.

## Recommended Execution Order

### Phase 1: Durable Boundary Root

1. `2026-04-23-storage-durable-boundary-and-storage-postgres-root.md`

Run this first. The rest of the work assumes `storage-durable` and `storage-postgres` already exist as the new main-storage public names.

### Phase 2: Durable Consumer Rewire And Old Name Deletion

2. `2026-04-23-storage-durable-consumer-rewire-and-cleanup.md`

Run this second. It makes the new durable names real for API-server and removes `storage-pg` only after the replacement compiles and tests green.

### Phase 3: Data-Source Plugin Contract Root

3. `2026-04-23-data-source-plugin-contract-and-runner.md`

Run this third. The platform service layer must not start before the plugin contract, loader, and host surface are stable.

### Phase 4: Data-Source Platform Domain And API

4. `2026-04-23-data-source-platform-domain-and-api.md`

Run this fourth. It depends on the plugin contract root because its service layer calls the runtime through the new `data_source` host rather than inventing a second protocol.

### Phase 5: Template, Guidance, And Final Regression

5. `2026-04-23-data-source-example-template-and-regression.md`

Run this last. It assumes both the durable boundary migration and the data-source platform runtime are already present.

## Shared Scope Rules

These rules apply to every plan in this set:

1. The main repo officially supports only one durable backend: `PostgreSQL`.
2. `storage-durable` is the capability boundary; `storage-postgres` is the concrete implementation.
3. External databases, SaaS products, and HTTP APIs must not be folded into `storage-durable`.
4. External data sources enter through plugin-based runtime extensions and platform-owned metadata records.
5. V1 supports `validate_config`, `test_connection`, `discover_catalog`, `describe_resource`, `preview_read`, and `import_snapshot`; it does not define a generic write-back contract.
6. Runtime extensions must not register HTTP routes, own OAuth callback endpoints, or run platform migrations.
7. Platform-owned metadata for external sources still lands in main durable storage.
8. Early compatibility shims are allowed only to support ordered migration between plans and must be removed by the cleanup or regression plans.

## Shared Naming Rules

Use these names consistently across plans:

1. “main durable storage” means the platform-owned long-lived persistence boundary.
2. “`storage-durable`” means the main durable capability crate.
3. “`storage-postgres`” means the PostgreSQL implementation crate.
4. “external data source” means a remote database, SaaS object model, or HTTP/API resource system that the platform does not own physically.
5. “`data-source-platform`” means the platform metadata and orchestration layer for external sources.
6. “data-source plugin” means a `runtime_extension` package that implements the `1flowbase.data_source/v1` contract.
7. “preview read” means temporary, non-durable sample access.
8. “import snapshot” means a controlled handoff into main durable storage.

## Dependency Notes

- The durable boundary plan owns the new crate names, workspace membership, and thin durable runtime surface.
- The durable consumer plan owns API-server rewires, old-name deletion, and docs/rules updates.
- The plugin-contract plan owns the new data-source runtime contract, package loader, plugin-runner host, and runtime route tests.
- The platform plan owns domain records, control-plane services, PostgreSQL persistence, API routes, and API runtime wiring.
- The final template/regression plan owns author-facing examples, plugin author guidance, focused regression, and QA closeout.
