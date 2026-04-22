# Structural Split Phase Three Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reduce `orchestration_runtime.rs` entropy by moving its test-only repository/runtime fixtures and seed helpers out of the production file and into dedicated `_tests` support modules.

**Architecture:** Keep production behavior unchanged. The split only relocates `#[cfg(test)]` code: the in-memory repository/runtime doubles, fixture package writers, seeded-flow builders, and the orchestration runtime unit tests. The key constraint is preserving the existing test API (`OrchestrationRuntimeService::for_tests()` and the seed helpers) while removing large test blocks from the production owner.

**Tech Stack:** Rust, `#[cfg(test)]` module paths, async trait test doubles, cargo test.

---

## File Structure

**Modify**
- `api/crates/control-plane/src/orchestration_runtime.rs`
- `api/crates/control-plane/src/_tests/mod.rs`
- `docs/superpowers/plans/2026-04-22-structural-split-phase-three.md`

**Create**
- `api/crates/control-plane/src/_tests/orchestration_runtime/mod.rs`
- `api/crates/control-plane/src/_tests/orchestration_runtime/service.rs`
- `api/crates/control-plane/src/_tests/orchestration_runtime/resume.rs`
- `api/crates/control-plane/src/_tests/orchestration_runtime/support.rs`

**Delete**
- `api/crates/control-plane/src/_tests/orchestration_runtime_service_tests.rs`
- `api/crates/control-plane/src/_tests/orchestration_runtime_resume_tests.rs`

**Run**
- `cargo test --manifest-path api/Cargo.toml -p control-plane orchestration_runtime -- --nocapture`
- `cargo test --manifest-path api/Cargo.toml -p control-plane -- --nocapture`

## Task 1: Extract Orchestration Runtime Test Support

**Files:**
- Modify: `api/crates/control-plane/src/orchestration_runtime.rs`
- Create: `api/crates/control-plane/src/_tests/orchestration_runtime/support.rs`

- [x] **Step 1: Move the `#[cfg(test)]` support block into a dedicated support module**

Relocate these test-only items from `orchestration_runtime.rs` into `src/_tests/orchestration_runtime/support.rs`:

- `InMemoryOrchestrationRuntimeState`
- `InMemoryOrchestrationRuntimeRepository`
- all trait impls for the in-memory repository/runtime
- `write_test_provider_package`
- `write_test_capability_package`
- `SeededPreviewApplication`
- `SeededWaitingHumanRun`
- `SeededWaitingCallbackRun`
- the `OrchestrationRuntimeService<...>::for_tests()` / seed helper impl
- the four fixture document builders

- [x] **Step 2: Keep private-field access legal through a child test-support module**

In `orchestration_runtime.rs`, replace the inline test block with:

```rust
#[cfg(test)]
#[path = "_tests/orchestration_runtime/support.rs"]
mod test_support;
```

This keeps the support code physically under `_tests/` while still compiling it as a child of `orchestration_runtime`, so the moved impl can legally access private fields like `self.repository`.

## Task 2: Re-home The Orchestration Runtime Unit Tests

**Files:**
- Modify: `api/crates/control-plane/src/_tests/mod.rs`
- Create: `api/crates/control-plane/src/_tests/orchestration_runtime/mod.rs`
- Create: `api/crates/control-plane/src/_tests/orchestration_runtime/service.rs`
- Create: `api/crates/control-plane/src/_tests/orchestration_runtime/resume.rs`
- Delete: `api/crates/control-plane/src/_tests/orchestration_runtime_service_tests.rs`
- Delete: `api/crates/control-plane/src/_tests/orchestration_runtime_resume_tests.rs`

- [x] **Step 1: Collect the runtime tests into a subdirectory**

Replace the two flat module entries in `_tests/mod.rs` with one grouped module:

```rust
mod orchestration_runtime;
```

and put the existing service/resume tests into the new subdirectory modules.

- [x] **Step 2: Preserve test coverage and imports verbatim**

The new `service.rs` and `resume.rs` files should keep the same assertions and the same public test API usage:

```rust
let service = OrchestrationRuntimeService::for_tests();
```

No behavior change, only path and module-owner change.

## Task 3: Verify And Record The Structural Split

**Files:**
- Modify: `docs/superpowers/plans/2026-04-22-structural-split-phase-three.md`

- [x] **Step 1: Run focused orchestration runtime tests**

Run:

```bash
cargo test --manifest-path api/Cargo.toml -p control-plane orchestration_runtime -- --nocapture
```

Expected:

- All orchestration runtime unit tests pass after the support move.

- [x] **Step 2: Run the full control-plane crate tests**

Run:

```bash
cargo test --manifest-path api/Cargo.toml -p control-plane -- --nocapture
```

Expected:

- The crate still passes, proving the split did not leak test-only paths or break unrelated services.

- [x] **Step 3: Append execution notes**

Add:

```md
## Execution Notes

- `2026-04-22`: extracted orchestration runtime test support ...
- `2026-04-22`: grouped orchestration runtime tests under `_tests/orchestration_runtime/` ...
- `2026-04-22`: `cargo test -p control-plane orchestration_runtime` ...
- `2026-04-22`: `cargo test -p control-plane` ...
```

- [ ] **Step 4: Commit the Phase 3 structural split**

```bash
git add api/crates/control-plane/src/orchestration_runtime.rs api/crates/control-plane/src/_tests/mod.rs api/crates/control-plane/src/_tests/orchestration_runtime docs/superpowers/plans/2026-04-22-structural-split-phase-three.md
git commit -m "refactor: split orchestration runtime test support"
```

## Execution Notes

- `2026-04-22`: `orchestration_runtime.rs` 的整块 `#[cfg(test)]` support 已迁到 [support.rs](/home/taichu/git/1flowbase-project-maintenance/api/crates/control-plane/src/_tests/orchestration_runtime/support.rs)，生产文件只保留 `#[path = "_tests/orchestration_runtime/support.rs"] mod test_support;` 入口。
- `2026-04-22`: [orchestration_runtime.rs](/home/taichu/git/1flowbase-project-maintenance/api/crates/control-plane/src/orchestration_runtime.rs) 从 `3213` 行降到 `1352` 行，测试支撑文件独立承接 `1842` 行 fixture / in-memory repo / seed helper。
- `2026-04-22`: orchestration runtime 相关测试已收纳到 `src/_tests/orchestration_runtime/`，原先平铺的 `orchestration_runtime_service_tests.rs` / `orchestration_runtime_resume_tests.rs` 已删除，根 `_tests/mod.rs` 改为单一 `mod orchestration_runtime;` 入口。
- `2026-04-22`: `cargo test --manifest-path api/Cargo.toml -p control-plane orchestration_runtime -- --nocapture` 通过，`6` 个 orchestration runtime 测试全部通过。
- `2026-04-22`: `cargo test --manifest-path api/Cargo.toml -p control-plane -- --nocapture` 通过，`72` 个 `control-plane` 单元测试全部通过。
