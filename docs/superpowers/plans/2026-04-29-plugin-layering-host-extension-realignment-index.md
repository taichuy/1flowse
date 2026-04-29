# Plugin Layering Host Extension Realignment Implementation Plan Index

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert the approved plugin layering and HostExtension realignment design into dependency-aware execution slices.

**Architecture:** Execute this as one index plus six ordered implementation plans. The first plan freezes local rules and docs, then the code plans introduce HostExtension contribution metadata, pre-state infrastructure bootstrap, Resource Action Kernel, route/worker/migration registries, and finally move builtin host manifests into `api/plugins/host-extensions`.

**Tech Stack:** Markdown plan docs, Rust backend workspace, Axum API-server, plugin-framework, control-plane, storage-durable PostgreSQL, storage-ephemeral.

---

## Approved Design Sources

Use these documents as the source of truth:

1. [2026-04-29-plugin-layering-and-host-extension-realignment-design.md](../specs/2026-04-29-plugin-layering-and-host-extension-realignment-design.md)
2. [2026-04-29-plugin-layering-and-host-extension-realignment-execution-addendum.md](../specs/2026-04-29-plugin-layering-and-host-extension-realignment-execution-addendum.md)

## Execution Plans

1. [Plan A: Local Rules And Docs](./2026-04-29-plugin-layering-host-extension-plan-a-local-rules-and-docs.md)
   Updates `api/AGENTS.md`, plugin README, env examples, and quick-start docs so all agents and humans use the new target architecture before code changes.
2. [Plan B: HostExtension Manifest And Load Plan](./2026-04-29-plugin-layering-host-extension-plan-b-manifest-and-load-plan.md)
   Adds `host-extension.yaml` parsing, contribution validation, bootstrap phases, and load-plan failure behavior without executing native code yet.
3. [Plan C: Pre-State Infrastructure Bootstrap](./2026-04-29-plugin-layering-host-extension-plan-c-pre-state-infra-bootstrap.md)
   Replaces Core Redis env selection with a `HostInfrastructureRegistry` and a default `local-infra-host` provider before `ApiState` construction.
4. [Plan D: Resource Action Kernel v1](./2026-04-29-plugin-layering-host-extension-plan-d-resource-action-kernel-v1.md)
   Adds resource/action definitions, hook ordering, transaction pipeline semantics, and migrates `plugins.install` plus `files.upload` as the first two governed actions.
5. [Plan E: HostExtension Route Worker Migration Namespace](./2026-04-29-plugin-layering-host-extension-plan-e-route-worker-migration.md)
   Adds controlled route registration, worker registry, and extension-owned PostgreSQL migration namespace.
6. [Plan F: Builtin Host Manifest Migration And Regression](./2026-04-29-plugin-layering-host-extension-plan-f-builtin-manifest-regression.md)
   Moves builtin host manifests into `api/plugins/host-extensions/*`, introduces plugin sets, removes long-term api-server builtin manifest ownership, and closes with regression.

## Recommended Order

### Phase 1: Governance Rules

Run Plan A first. Every later plan depends on updated local rules, env examples, and plugin directory expectations.

### Phase 2: HostExtension Metadata Root

Run Plan B second. Plan C, E, and F depend on the new contribution manifest and load-plan validation.

### Phase 3: Early Infrastructure Provider Bootstrap

Run Plan C third. Plan D needs the infrastructure facade inside `ActionContext`, and Plan F must not migrate builtin infra manifests before local provider bootstrap exists.

### Phase 4: Governed Action Surface

Run Plan D fourth. HostExtension routes and workers must call resource actions rather than bypass service commands.

### Phase 5: HostExtension Owned Runtime Surface

Run Plan E fifth. It depends on HostExtension contribution metadata, infrastructure registry, and Resource Action Kernel boundaries.

### Phase 6: Builtin Manifest Migration And Closeout

Run Plan F last. It assumes all registries exist, then moves builtin host declarations out of api-server and performs full backend regression.

## Shared Scope Rules

1. Development is early stage: do not add compatibility shims for the old `API_EPHEMERAL_BACKEND=redis` target shape.
2. `HostExtension` is trusted `root/system` host code loaded at boot, not a workspace user plugin.
3. Native HostExtension v1 is in-process and restart-scoped; do not design Rust native hot unload.
4. RuntimeExtension only implements runtime slots such as `model_provider`, `data_source`, and `file_processor`.
5. CapabilityPlugin only contributes workspace-selected app/workflow capabilities.
6. Redis, NATS, RabbitMQ, queue backends, and rate-limit stores are HostExtension infrastructure implementations, not Core hard-coded branches.
7. HostExtension can own extension namespace resources, migrations, routes, workers, and hooks, but cannot directly change Core truth tables.
8. Core owns plugin lifecycle tables, permission policy, audit, security policy, durable outbox semantics, and Resource Action Kernel.
9. New core write actions must enter through Resource Action Kernel before being exposed as stable HostExtension extension points.

## Shared Verification Rules

1. Run commands from `api/` for Cargo work unless a plan explicitly says repository root.
2. Run `cargo fmt` before each code commit.
3. Run targeted package tests after each task.
4. Do not run multiple Cargo verification commands in parallel in the same workspace.
5. Put warning and coverage artifacts under `tmp/test-governance/`.
6. Use `qa-evaluation` before marking the final plan set complete.

## Dependency Notes

- Plan B owns HostExtension contribution schema and load-plan validation.
- Plan C owns early infrastructure provider registration and removal of Core Redis env selection.
- Plan D owns Resource Action Kernel and the first migrated Core actions.
- Plan E owns host route registry, worker registry, and extension migration namespace.
- Plan F owns source workspace migration for builtin host manifests, plugin set files, docs cleanup, and final regression.
