# Web Mock UI Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a repeatable script that rebuilds `tmp/mock-ui` from `web` and rewrites the mock sandbox frontend port to `3210`.

**Architecture:** Implement a small Node CLI under `scripts/node/mock-ui-sync.js` with a focused `core.js` module for argument parsing, copy/reset logic, and Vite port rewriting. Test the filesystem behavior against a temporary fake repo so the real workspace is not mutated during unit tests.

**Tech Stack:** Node.js 22, built-in `fs`/`path`, `node:test`, `assert`

---

## File Structure

**Create**
- `scripts/node/mock-ui-sync.js`
- `scripts/node/mock-ui-sync/core.js`
- `scripts/node/mock-ui-sync/_tests/core.test.js`
- `docs/superpowers/specs/1flowse/2026-04-13-web-mock-ui-sync-design.md`
- `.memory/project-memory/2026-04-13-mock-ui-sandbox-sync.md`

**Modify**
- `README.md`

## Task 1: Lock Expected Behavior With Tests

**Files:**
- Create: `scripts/node/mock-ui-sync/_tests/core.test.js`

- [ ] Step 1: Add a failing test for CLI defaults.
- [ ] Step 2: Add a failing test for reset-copy-rewrite behavior against a temporary fake repo.
- [ ] Step 3: Run `node --test scripts/node/mock-ui-sync/_tests/core.test.js` and confirm failure because the module does not exist yet.

## Task 2: Implement The Sync CLI

**Files:**
- Create: `scripts/node/mock-ui-sync.js`
- Create: `scripts/node/mock-ui-sync/core.js`

- [ ] Step 1: Add CLI parsing with defaults `source=web`、`target=tmp/mock-ui`、`port=3210`.
- [ ] Step 2: Implement reset-and-copy behavior with source exclusion for runtime garbage directories.
- [ ] Step 3: Rewrite copied `app/vite.config.ts` so the mock sandbox uses port `3210`.
- [ ] Step 4: Re-run `node --test scripts/node/mock-ui-sync/_tests/core.test.js` and confirm green.

## Task 3: Document The Entry

**Files:**
- Modify: `README.md`
- Create: `.memory/project-memory/2026-04-13-mock-ui-sandbox-sync.md`

- [ ] Step 1: Add the mock-ui sync command to the local development docs.
- [ ] Step 2: Record the sandbox decision in project memory for later turns.
