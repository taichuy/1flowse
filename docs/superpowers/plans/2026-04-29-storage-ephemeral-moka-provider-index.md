# Storage Ephemeral Moka Provider Implementation Plan Index

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert the approved storage-ephemeral, Moka local provider, and restart-scoped provider activation design into ordered execution plans.

**Architecture:** Execute this as one index plus four ordered implementation plans. The first two plans stabilize host infrastructure contracts and local implementations, then the provider desired-state plan makes installed manifest/schema configuration available before provider runtime activation, and the final frontend plan exposes the one-restart flow in settings.

**Tech Stack:** Rust backend workspace, Axum api-server, control-plane ports, storage-ephemeral, moka 0.12.15 with `future`, PostgreSQL durable store, React, Ant Design, TanStack Query, @1flowbase/api-client.

---

## Approved Design Source

Use [2026-04-29-storage-ephemeral-moka-provider-design.md](../specs/2026-04-29-storage-ephemeral-moka-provider-design.md) as the source of truth.

This plan also depends on the completed HostExtension realignment plans:

1. [Plugin Layering Host Extension Realignment Index](./2026-04-29-plugin-layering-host-extension-realignment-index.md)
2. [Plan C: Pre-State Infrastructure Bootstrap](./2026-04-29-plugin-layering-host-extension-plan-c-pre-state-infra-bootstrap.md)

## Execution Plans

1. [x] [Plan A: Host Infrastructure Contracts](./2026-04-29-storage-ephemeral-moka-provider-plan-a-contracts.md)
   Moves `CacheStore`, `DistributedLock`, `EventBus`, `TaskQueue`, and `RateLimitStore` from api-server placeholder identity traits into control-plane ports with real async operations, then rewires `HostInfrastructureRegistry` to depend on those contracts.
2. [x] [Plan B: Local Moka Providers](./2026-04-29-storage-ephemeral-moka-provider-plan-b-local-moka.md)
   Adds `moka` to `storage-ephemeral`, implements `MokaCacheStore`, `MokaSessionStore`, `MokaRateLimitStore`, memory-backed lock/event/task providers, and registers them in `local-infra-host`.
3. [x] [Plan C: Provider Desired State And Config API](./2026-04-29-storage-ephemeral-moka-provider-plan-c-provider-desired-state.md)
   Adds host infrastructure provider config schema parsing, stores desired provider config/default-contract selection as restart-scoped system state, and exposes console APIs that work from installed package manifest/schema before provider runtime activation.
4. [x] [Plan D: Settings Infrastructure Provider UI](./2026-04-29-storage-ephemeral-moka-provider-plan-d-settings-ui.md)
   Adds `/settings/host-infrastructure` with installed provider discovery, schema-generated config forms, contract selection, save-and-enable in one action, and a single restart-required state.

## Scope Boundaries

1. Do not implement a Redis runtime provider in this plan set.
2. Do not restore `API_EPHEMERAL_BACKEND=redis` or `API_REDIS_URL`.
3. Do not implement provider instance runtime hot switching.
4. The Redis configuration page must be generated from installed `manifest.yaml` and `host-extension.yaml`, not from an already running Redis provider.
5. Install, configure, and enable may be saved as one pending restart change.
6. The final user path requires one api-server restart after the pending change is saved.
7. The bad two-restart path is explicitly rejected: enable plugin, restart, only then show config page, configure Redis, restart again.
8. `TaskQueue` contract uses at-least-once + idempotency key + visibility timeout; memory queue is only for disposable or rebuildable work, while durable business jobs stay on PostgreSQL outbox / job tables.

## Recommended Order

### Phase 1: Contract Surface

Run Plan A first. Plan B and Plan C both need operation-level contract traits outside `api-server` so control-plane services and storage implementations do not depend on api-server internals.

### Phase 2: Local Provider Implementation

Run Plan B second. The local provider must remain the default and keep local development dependent only on PostgreSQL.

### Phase 3: Restart-Scoped Desired State

Run Plan C third. It establishes the backend rule that installed provider config is editable before provider runtime activation and that a saved config/enable operation becomes one pending restart state.

### Phase 4: Settings UI

Run Plan D last. It consumes the new console APIs and turns the backend semantics into the visible one-restart flow.

## Shared Verification Rules

1. Run Cargo commands from `api/`.
2. Do not run multiple Cargo test commands in parallel in the same workspace.
3. Run `cargo fmt` before each backend commit.
4. Frontend targeted tests should use `node scripts/node/test-frontend.js fast` or the existing package script path described in `web/AGENTS.md`; do not bypass resource limits with raw `pnpm exec vitest`.
5. Warning and coverage artifacts belong under `tmp/test-governance/`.
6. Use `qa-evaluation` before closing the plan set.

## Completion Criteria

1. `api-server` starts locally with PostgreSQL only and registers local providers for all infrastructure contracts.
2. Business/control-plane code imports only host infrastructure contract traits, never `moka` or Redis clients.
3. Cache miss returns `None`; callers recover by loading durable truth.
4. Removing local cache cannot change business correctness.
5. Installed HostExtension provider configuration can be viewed and edited while the provider runtime is inactive.
6. Saving config plus enabling contracts returns `restart_required: true` and does not activate the provider in-process.
7. Settings UI never requires the user to restart once just to see the provider config form.
8. Disabled and runtime-inactive installed providers still appear in `/settings/host-infrastructure` with schema-generated config forms.
9. A provider that implements multiple contracts appears as one configurable provider row grouped by `(installation_id, provider_code, config_ref)`.
10. Native provider activation remains restart-scoped; save/config/enable never mutates active provider trait objects in-process.
