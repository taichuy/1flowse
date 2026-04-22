# Scripts Node Normalization Phase Three Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reduce `scripts/node` sprawl by splitting `plugin/core.js`, shrinking top-level entrypoint count, and aligning command ownership with script domains.

**Architecture:** Keep CLI behavior stable while moving implementation into focused modules. `scripts/node/plugin/core.js` becomes a small dispatcher over `init`, `package`, `manifest`, and `release` helpers. Then normalize top-level `scripts/node` entrypoints by grouping verification and test orchestration under domain directories with intentionally thin launch files.

**Tech Stack:** Node.js, CommonJS modules, repository script entrypoints, `node:test`.

---

## File Structure

**Modify**
- `scripts/node/plugin/core.js`
- `scripts/node/plugin.js`
- `docs/superpowers/plans/2026-04-22-scripts-node-normalization-phase-three.md`

**Create**
- `scripts/node/plugin/init.js`
- `scripts/node/plugin/manifest.js`
- `scripts/node/plugin/package.js`
- `scripts/node/plugin/release.js`
- `scripts/node/plugin/fs.js`
- `scripts/node/test/index.js`
- `scripts/node/verify/index.js`
- `scripts/node/tooling/index.js`

**Delete or Move**
- legacy single-purpose top-level entrypoints once all references are updated in the same change set

**Run**
- `node scripts/node/test-scripts.js`
- `node scripts/node/verify-repo.js`

## Task 1: Split Plugin Script Core

**Files:**
- Modify: `scripts/node/plugin/core.js`
- Create: `scripts/node/plugin/*.js`

- [ ] **Step 1: Keep `core.js` as command dispatcher**
- [x] **Step 1: Keep `core.js` as command dispatcher**

`core.js` should only parse CLI args and delegate.

- [ ] **Step 2: Move implementation by concern**
- [x] **Step 2: Move implementation by concern**

- `init.js`: plugin scaffolding/init
- `manifest.js`: manifest/provider code derivation and metadata shaping
- `package.js`: package/archive assembly
- `release.js`: release metadata and signing flow
- `fs.js`: reusable filesystem helpers

## Task 2: Normalize `scripts/node` Topology

**Files:**
- Create grouped dispatchers and move command implementations under them

- [ ] **Step 1: Group test entrypoints**
- [x] **Step 1: Group test entrypoints**

Consolidate:

- `test-backend.js`
- `test-contracts.js`
- `test-frontend.js`
- `test-scripts.js`

behind a `scripts/node/test/` implementation tree.

- [ ] **Step 2: Group verify entrypoints**
- [x] **Step 2: Group verify entrypoints**

Consolidate:

- `verify-backend.js`
- `verify-ci.js`
- `verify-coverage.js`
- `verify-repo.js`

behind a `scripts/node/verify/` implementation tree.

- [ ] **Step 3: Group tooling helpers**
- [x] **Step 3: Group tooling helpers**

Move `page-debug`, `check-style-boundary`, `mock-ui-sync`, `claude-skill-sync`, and runtime-gate orchestration behind `scripts/node/tooling/`.

## Task 3: Verify And Record

**Files:**
- Modify: `docs/superpowers/plans/2026-04-22-scripts-node-normalization-phase-three.md`

- [ ] **Step 1: Run script tests**
- [x] **Step 1: Run script tests**

```bash
node scripts/node/test-scripts.js
```

- [ ] **Step 2: Run repo verification**
- [x] **Step 2: Run repo verification**

```bash
node scripts/node/verify-repo.js
```

- [ ] **Step 3: Append execution notes and commit**
- [x] **Step 3: Append execution notes and commit**

```bash
git add scripts/node docs/superpowers/plans/2026-04-22-scripts-node-normalization-phase-three.md
git commit -m "refactor: normalize node script owners"
```

## Execution Notes

- Completed on `2026-04-22`.
- Reduced `scripts/node/plugin/core.js` from `1414` lines to `280` lines by keeping only CLI usage, argument parsing, command dispatch, and process-lifecycle glue in the façade.
- Split plugin implementation into focused owners: `plugin/init.js`, `plugin/manifest.js`, `plugin/package.js`, `plugin/release.js`, and `plugin/fs.js`.
- Added grouped dispatchers at `scripts/node/test/index.js`, `scripts/node/verify/index.js`, and `scripts/node/tooling/index.js`, then turned the existing top-level entrypoints into thin compatibility façades that re-export or forward to the grouped owners.
- Moved repository-owned orchestration to grouped command trees, so `verify-repo` and `verify-ci` now delegate through `scripts/node/test` and `scripts/node/verify`, while frontend/style and runtime-gate flows delegate through `scripts/node/tooling`.
- Residual note: `scripts/node` top-level file count intentionally remains `17` because the stable CLI wrappers are still the supported public entrypoints; the entropy reduction in this slice is owner normalization, not public command deletion.

## Verification Evidence

- `node --test scripts/node/plugin/_tests/modules.test.js scripts/node/plugin/_tests/core.test.js`
- `node --test scripts/node/test/_tests/index.test.js scripts/node/verify/_tests/index.test.js scripts/node/tooling/_tests/index.test.js`
- `node --test scripts/node/test-backend/_tests/cli.test.js scripts/node/test-contracts/_tests/cli.test.js scripts/node/test-frontend/_tests/cli.test.js scripts/node/test-scripts/_tests/cli.test.js scripts/node/verify-backend/_tests/cli.test.js scripts/node/verify-ci/_tests/cli.test.js scripts/node/verify-repo/_tests/cli.test.js scripts/node/verify-coverage/_tests/cli.test.js scripts/node/runtime-gate/_tests/cli.test.js`
- `node scripts/node/test-scripts.js`
- `node scripts/node/verify-repo.js`
