# Control Plane Directory Pressure Reduction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reduce `api/crates/control-plane/src` and `api/crates/control-plane/src/_tests` direct file counts to the repository limit without changing public behavior.

**Architecture:** Use the lowest-risk structure-only approach. Keep all existing public module names and test import surfaces stable, but convert selected flat `*.rs` owners into `mod.rs` directory façades so direct file pressure drops without reopening business logic.

**Tech Stack:** Rust module trees, crate unit tests, repository plan docs.

---

## File Structure

**Modify**
- `api/crates/control-plane/src/lib.rs`
- `api/crates/control-plane/src/_tests/mod.rs`
- `docs/superpowers/plans/2026-04-22-control-plane-directory-pressure-reduction.md`

**Move production owners**
- `api/crates/control-plane/src/application.rs` -> `api/crates/control-plane/src/application/mod.rs`
- `api/crates/control-plane/src/flow.rs` -> `api/crates/control-plane/src/flow/mod.rs`
- `api/crates/control-plane/src/member.rs` -> `api/crates/control-plane/src/member/mod.rs`
- `api/crates/control-plane/src/profile.rs` -> `api/crates/control-plane/src/profile/mod.rs`
- `api/crates/control-plane/src/role.rs` -> `api/crates/control-plane/src/role/mod.rs`
- `api/crates/control-plane/src/session_security.rs` -> `api/crates/control-plane/src/session_security/mod.rs`
- `api/crates/control-plane/src/system_runtime.rs` -> `api/crates/control-plane/src/system_runtime/mod.rs`
- `api/crates/control-plane/src/workspace.rs` -> `api/crates/control-plane/src/workspace/mod.rs`
- `api/crates/control-plane/src/workspace_session.rs` -> `api/crates/control-plane/src/workspace_session/mod.rs`

**Move test owners**
- `api/crates/control-plane/src/_tests/application_service_tests.rs` -> `api/crates/control-plane/src/_tests/application/mod.rs`
- `api/crates/control-plane/src/_tests/flow_service_tests.rs` -> `api/crates/control-plane/src/_tests/flow/mod.rs`
- `api/crates/control-plane/src/_tests/member_service_tests.rs` -> `api/crates/control-plane/src/_tests/member/mod.rs`
- `api/crates/control-plane/src/_tests/profile_service_tests.rs` -> `api/crates/control-plane/src/_tests/profile/mod.rs`
- `api/crates/control-plane/src/_tests/role_service_tests.rs` -> `api/crates/control-plane/src/_tests/role/mod.rs`
- `api/crates/control-plane/src/_tests/session_security_service_tests.rs` -> `api/crates/control-plane/src/_tests/session_security/mod.rs`
- `api/crates/control-plane/src/_tests/system_runtime_service_tests.rs` -> `api/crates/control-plane/src/_tests/system_runtime/mod.rs`
- `api/crates/control-plane/src/_tests/workspace_service_tests.rs` -> `api/crates/control-plane/src/_tests/workspace/mod.rs`
- `api/crates/control-plane/src/_tests/workspace_session_service_tests.rs` -> `api/crates/control-plane/src/_tests/workspace_session/mod.rs`

**Run**
- `cargo test --manifest-path api/Cargo.toml -p control-plane -- --nocapture`
- `node scripts/node/verify-backend.js`
- `find api/crates/control-plane/src -maxdepth 1 -type f | wc -l`
- `find api/crates/control-plane/src/_tests -maxdepth 1 -type f | wc -l`

## Task 1: Write The Plan And Freeze Scope

- [x] Record the move-only scope in this plan file.
- [x] Keep the target narrow: directory pressure only, no service logic changes.

## Task 2: Move Production Owners Into Directory Façades

- [x] Convert the 9 selected flat production files into same-name directories with `mod.rs`.
- [x] Keep `lib.rs` public module declarations unchanged so external call sites continue using `crate::application`, `crate::workspace`, and the other existing names.

## Task 3: Move Test Owners Into Directory Façades

- [x] Convert the 9 selected `_tests` files into same-name directories with `mod.rs`.
- [x] Update `api/crates/control-plane/src/_tests/mod.rs` to reference the new grouped modules.
- [x] Keep test code content and import surfaces stable unless a moved file requires a local path fix.

## Task 4: Verify And Record

- [x] Re-run `control-plane` crate tests that cover the moved owners.
- [x] Re-run the full `control-plane` crate tests.
- [x] Re-run the backend repo gate.
- [x] Recount direct files under `src` and `src/_tests`.
- [x] Append execution notes with final counts and any residual caveat.

## Execution Notes

- The selected production owners were converted from flat files to same-name directory façades without changing `lib.rs` exports:
  - `application`, `flow`, `member`, `profile`, `role`, `session_security`, `system_runtime`, `workspace`, `workspace_session`
- The matching `_tests` owners were moved into same-name grouped directories, and `api/crates/control-plane/src/_tests/mod.rs` now points at those grouped modules instead of the old `*_service_tests.rs` flat files.
- No service code behavior changed during the move; this phase was limited to owner placement and module entrypoints.
- Verification completed so far:
- Verification completed:
  - `cargo test --manifest-path api/Cargo.toml -p control-plane -- --nocapture`
  - `node scripts/node/verify-backend.js`
- Direct file counts after the move:
  - `api/crates/control-plane/src`: `15`
  - `api/crates/control-plane/src/_tests`: `11`
- Residual caveat:
  - This phase normalized the two directory-level pressure points that remained after the larger quality remediation. It did not change the already-whitelisted `globals.css` theme defaults, and it did not reopen any production-owner boundary decisions outside `control-plane/src`.
