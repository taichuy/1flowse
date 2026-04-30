# Data Source Data Model Runtime CRUD Implementation Plan Index

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert the approved data source, Data Model, dynamic table, runtime CRUD, API exposure, external source, and Settings design into ordered implementation slices.

**Architecture:** Execute this as one index plus eight ordered implementation plans. The backend plans first stabilize metadata, `main_source`, scope grants, API exposure, secrets, and external source contracts; the later plans add Advisor/OpenAPI, Settings UI, orchestration nodes, and final scope provider verification.

**Tech Stack:** Rust backend workspace, Axum api-server, control-plane, runtime-core, storage-durable PostgreSQL, plugin-framework RuntimeExtension contracts, React, Ant Design, TanStack Query, @1flowbase/api-client.

---

## Approved Design Source

Use [2026-04-29-data-source-data-model-runtime-crud-design.md](../specs/2026-04-29-data-source-data-model-runtime-crud-design.md) as the source of truth.

Related completed design work:

1. [Storage Durable And External Data Source Platform Design](../specs/2026-04-23-storage-durable-and-external-data-source-platform-design.md)
2. [Plugin Layering And HostExtension Realignment Design](../specs/2026-04-29-plugin-layering-and-host-extension-realignment-design.md)
3. [Plugin Layering HostExtension Realignment Index](./2026-04-29-plugin-layering-host-extension-realignment-index.md)

## Execution Plans

1. [x] [Plan A: Domain, Storage, And Defaults](./2026-04-30-data-source-data-model-plan-a-domain-storage-defaults.md)
   Adds Data Model status, API exposure status, data source defaults, protected-model metadata, and scope grant persistence.
2. [x] [Plan B: main_source Runtime CRUD](./2026-04-30-data-source-data-model-plan-b-main-source-runtime-crud.md)
   Makes `main_source` create system-owned dynamic tables, enforces status gates, and keeps runtime CRUD scoped through `DEFAULT_SCOPE_ID`.
3. [x] [Plan C: Permission And API Exposure](./2026-04-30-data-source-data-model-plan-c-permission-api-exposure.md)
   Adds API Key actor support, scope grants, exposure readiness calculation, runtime permission checks, and audit events.
4. [x] [Plan D: External Source And Secret Reference](./2026-04-30-data-source-data-model-plan-d-external-source-secret.md)
   Extends data-source RuntimeExtension contracts for PostgreSQL and REST CRUD, adds secret references, and blocks unsafe external exposure.
5. [x] [Plan E: Advisor, Protected Models, And API Docs](./2026-04-30-data-source-data-model-plan-e-advisor-protected-openapi.md)
   Adds protected-model enforcement, Data Model Advisor findings, and dynamic Data Model API documentation.
6. [ ] [Plan F: Settings Data Source UI](./2026-04-30-data-source-data-model-plan-f-settings-ui.md)
   F-A adds Settings / 数据源 baseline with data source defaults, Data Model status, permissions, API readiness display, Advisor, and record preview; F-B still covers create/edit/delete management flows and final frontend verification.
7. [ ] [Plan G: Orchestration Data Model Node](./2026-04-30-data-source-data-model-plan-g-orchestration-node.md)
   Adds the generic Data Model node, dynamic schema loading, runtime CRUD execution, and workflow actor checks.
8. [ ] [Plan H: Scope Provider And Final QA](./2026-04-30-data-source-data-model-plan-h-scope-provider-qa.md)
   Verifies the core does not depend on workspace UI, defines the future scope provider contract, and runs final backend/frontend QA gates.

## Recommended Order

### Phase 1: Metadata And `main_source`

Run Plan A first, then Plan B. Plan B depends on persisted status/default/scope-grant fields from Plan A.

### Phase 2: API Safety Surface

Run Plan C after runtime CRUD is functional. API Key calls and exposure readiness need a real runtime target and permission model.

### Phase 3: External Source Integration

Run Plan D after Plan C. External sources must reuse the same platform permission, secret, audit, and API exposure layer.

### Phase 4: Safety And Developer Experience

Run Plan E after Plans C and D. Advisor and API docs need exposure status, protected metadata, and external-source safety capability.

### Phase 5: Product Surface

Run Plan F after the backend APIs exist. Settings UI should consume stable console DTOs rather than hard-code mock behavior.

### Phase 6: Runtime Consumers And Closure

Run Plan G, then Plan H. The orchestration node consumes the runtime CRUD contract; final QA closes cross-plan regressions and scope provider extensibility.

## Shared Scope Rules

1. Product name is `Data Model / 数据模型`; internal code may keep `model_definition / model_field / runtime_model`.
2. Built-in main data source is `main_source`; do not expose PostgreSQL implementation details in product labels.
3. Data Model IDs and all persisted IDs must be globally unique and never reused.
4. New Data Models default to `published`; default API exposure status is `published_not_exposed` unless data source settings override it.
5. `api_exposed_ready` must be computed from API Key, action permission, scope grant, scope filter, and audit configuration; do not allow a dropdown to force it.
6. `unsafe_external_source` is derived from plugin capability and platform validation; users cannot manually mark unsafe external data as safe.
7. Core keeps generic `scope_id` and `DEFAULT_SCOPE_ID`; workspace is a future HostExtension scope provider, not a V1 product dependency.
8. External data sources are direct CRUD targets through RuntimeExtension plugins; no import, sync, or cross-source transaction in this plan set.
9. Only system can create and structurally modify Data Models; non-system scopes use grants and permission profiles.
10. Deleting fields and records must write audit events. Record delete is physical delete in V1.

## Shared Verification Rules

1. Use `backend-development` when implementing backend plans and `frontend-development` when implementing Plan F.
2. Run Cargo commands from `api/`; do not run multiple Cargo commands in parallel in one workspace.
3. Run `cargo fmt` before each backend commit.
4. Frontend tests should use repository scripts, for example `node scripts/node/test-frontend.js fast`, not raw unconstrained Vitest.
5. Put warning and coverage artifacts under `tmp/test-governance/`.
6. Use `qa-evaluation` before marking the final plan set complete.

## Completion Criteria

1. `main_source` can create system-owned Data Models and runtime CRUD records in `published` status.
2. New Data Models default to `published` and `published_not_exposed`.
3. `draft / disabled / broken` Data Models are blocked from runtime CRUD.
4. API Key access cannot bypass scope grants, action permissions, scope filters, or audit.
5. External PostgreSQL and REST source plugins can expose Data Models through the same runtime CRUD layer.
6. Unsafe external sources cannot become `api_exposed_ready`.
7. Settings UI lets users manage data sources, defaults, Data Models, fields, permissions, API exposure, Advisor findings, and record preview.
8. The orchestration Data Model node can list/get/create/update/delete through runtime CRUD without direct SQL or plugin calls.
9. Workspace HostExtension scope provider can be added later without changing dynamic table structure or runtime CRUD query rules.
