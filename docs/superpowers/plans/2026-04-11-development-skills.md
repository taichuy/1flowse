# Development Skills Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create reusable `frontend-development` and `backend-development` skills that act as anti-decay development constraints rather than project-spec mirrors.

**Architecture:** Keep each skill small and searchable in `SKILL.md`, push the heavier decision tables and examples into `references/`, and make the verification focus on trigger quality, boundary clarity, anti-pattern coverage, and reference wiring. Treat the missing skill packages as the baseline RED state, then add the minimal documentation needed to cover the approved design.

**Tech Stack:** Markdown skill docs, local references, shell verification with `test`, `sed`, `rg`, and `wc`

---

## File Structure

**Create**
- `.agents/skills/frontend-development/SKILL.md`
- `.agents/skills/frontend-development/references/communication-gate.md`
- `.agents/skills/frontend-development/references/review-checklist.md`
- `.agents/skills/frontend-development/references/anti-patterns.md`
- `.agents/skills/frontend-development/references/examples.md`
- `.agents/skills/backend-development/SKILL.md`
- `.agents/skills/backend-development/references/api-design.md`
- `.agents/skills/backend-development/references/state-and-consistency.md`
- `.agents/skills/backend-development/references/boundary-design.md`
- `.agents/skills/backend-development/references/anti-patterns.md`
- `.agents/skills/backend-development/references/examples.md`

**Modify**
- `docs/superpowers/plans/2026-04-11-development-skills.md`

**Notes**
- Keep both `SKILL.md` files concise and trigger-oriented; move checklists and examples into `references/`.
- `frontend-development` must point to `frontend-logic-design` when interaction architecture is the real problem.
- `backend-development` must cover stable core vs adapter boundaries, AI-friendly APIs, state discipline, and unique-entry constraints without embedding project-specific facts.

### Task 1: Build The Frontend Skill Package

**Files:**
- Create: `.agents/skills/frontend-development/SKILL.md`
- Create: `.agents/skills/frontend-development/references/communication-gate.md`
- Create: `.agents/skills/frontend-development/references/review-checklist.md`
- Create: `.agents/skills/frontend-development/references/anti-patterns.md`
- Create: `.agents/skills/frontend-development/references/examples.md`

- [x] **Step 1: Run the missing frontend skill check**

Run: `test -f .agents/skills/frontend-development/SKILL.md`

Expected: exit code `1` because the frontend skill does not exist yet.

- [x] **Step 2: Write the frontend skill shell**

Create `.agents/skills/frontend-development/SKILL.md` with:

```md
---
name: frontend-development
description: Use when building or changing frontend pages, flows, interactions, or UI structure and need to keep state, boundaries, and reuse under control
---

# Frontend Development

## Overview
[Short statement: prevent page logic, state, and interaction rules from decaying into tangled UI code.]

## When to Use
- New page or page-level flow
- Interaction changes
- UI refactors that risk state sprawl
- Component extraction or reuse decisions

## The Iron Law
[Frontend changes must preserve interaction consistency and keep display, state, protocol, and route concerns from collapsing into one file.]

## Quick Reference
- Ask the user first for new pages, new flows, interaction changes, visual changes, and embedded AI collaboration surfaces
- Reuse existing components and mature dependencies before extracting new abstractions
- If the issue is navigation, hierarchy, or inconsistent interaction behavior, use `frontend-logic-design`

## Implementation
- See `references/communication-gate.md`
- See `references/review-checklist.md`
- See `references/anti-patterns.md`
- See `references/examples.md`

## Common Mistakes
[List the highest-signal frontend decay patterns.]
```

- [x] **Step 3: Write the frontend reference files**

Create `.agents/skills/frontend-development/references/communication-gate.md` with a decision table covering:

```md
# Frontend Communication Gate

| Change type | Ask first? | Reason |
| --- | --- | --- |
| New page | Yes | Changes user-visible structure |
| New workflow | Yes | Changes task path and expectations |
| Interaction flow change | Yes | Changes user behavior contract |
| Visual language change | Yes | Can fragment the system |
| Embedded AI collaboration surface | Yes | Product-facing assistance behavior needs human review |
| Local bugfix inside existing page grammar | Usually no | Fits existing contract |
| Straight reuse inside an existing pattern | Usually no | Low product ambiguity |
```
```

Create `.agents/skills/frontend-development/references/review-checklist.md` with before/during/after sections covering reuse, state placement, mixed responsibilities, and interaction consistency.

Create `.agents/skills/frontend-development/references/anti-patterns.md` with entries for page god-components, state sprawl, premature abstraction, protocol/UI mixing, and accidental new interaction grammar.

Create `.agents/skills/frontend-development/references/examples.md` with short examples for:
- do not extract a one-off shared component yet
- lift repeated workflow state out of nested widgets
- hand interaction architecture work to `frontend-logic-design`

- [x] **Step 4: Verify the frontend skill package**

Run: `sed -n '1,220p' .agents/skills/frontend-development/SKILL.md`

Expected: the file includes frontmatter, trigger conditions, iron law, reference links, and common mistakes.

Run: `wc -w .agents/skills/frontend-development/SKILL.md`

Expected: concise word count for a frequently loaded skill, ideally under `500`.

### Task 2: Build The Backend Skill Package

**Files:**
- Create: `.agents/skills/backend-development/SKILL.md`
- Create: `.agents/skills/backend-development/references/api-design.md`
- Create: `.agents/skills/backend-development/references/state-and-consistency.md`
- Create: `.agents/skills/backend-development/references/boundary-design.md`
- Create: `.agents/skills/backend-development/references/anti-patterns.md`
- Create: `.agents/skills/backend-development/references/examples.md`

- [x] **Step 1: Run the missing backend skill check**

Run: `test -f .agents/skills/backend-development/SKILL.md`

Expected: exit code `1` because the backend skill does not exist yet.

- [x] **Step 2: Write the backend skill shell**

Create `.agents/skills/backend-development/SKILL.md` with:

```md
---
name: backend-development
description: Use when building or changing backend APIs, state transitions, module boundaries, or core business logic and need to control coupling and consistency
---

# Backend Development

## Overview
[Short statement: keep stable core rules separate from adapters and stop state changes from spreading across the codebase.]

## When to Use
- API design or endpoint changes
- Module boundary changes
- State machine or workflow mutations
- Refactors where multiple services touch the same model

## The Iron Law
[Core business rules decide what should happen; adapters decide how it happens. External protocol details do not belong in the core.]

## Quick Reference
- Ask the user first for core state machine, protocol, permission, plugin-boundary, and core-object changes
- Keep API inputs short, flat, and single-purpose
- Make state sets, transitions, and action constraints explicit
- Give critical models and state changes one clear entry point

## Implementation
- See `references/api-design.md`
- See `references/state-and-consistency.md`
- See `references/boundary-design.md`
- See `references/anti-patterns.md`
- See `references/examples.md`

## Common Mistakes
[List the highest-signal backend decay patterns.]
```

- [x] **Step 3: Write the backend reference files**

Create `.agents/skills/backend-development/references/api-design.md` with concise rules for short parameter names, low field count, shallow nesting, single-action endpoints, and a “split it instead” rule for long or deeply nested requests.

Create `.agents/skills/backend-development/references/state-and-consistency.md` with a checklist for state set, transitions, action constraints, write ownership, and data/state consistency.

Create `.agents/skills/backend-development/references/boundary-design.md` with a stable-core-vs-adapter decision table and examples of where protocol mapping should stop.

Create `.agents/skills/backend-development/references/anti-patterns.md` with entries for protocol leakage, multi-writer state changes, overstuffed endpoints, implicit side effects, and adapter logic creeping into core rules.

Create `.agents/skills/backend-development/references/examples.md` with short examples for:
- splitting one giant endpoint into separate actions
- pulling external payload mapping back into an adapter
- introducing a single state transition entry instead of multi-writer updates

- [x] **Step 4: Verify the backend skill package**

Run: `sed -n '1,240p' .agents/skills/backend-development/SKILL.md`

Expected: the file includes frontmatter, trigger conditions, iron law, reference links, and common mistakes.

Run: `wc -w .agents/skills/backend-development/SKILL.md`

Expected: concise word count for a frequently loaded skill, ideally under `500`.

### Task 3: Review The Two Skills As A Pair

**Files:**
- Modify: `.agents/skills/frontend-development/SKILL.md`
- Modify: `.agents/skills/backend-development/SKILL.md`
- Modify: `.agents/skills/frontend-development/references/*.md`
- Modify: `.agents/skills/backend-development/references/*.md`

- [x] **Step 1: Verify trigger and boundary coverage**

Run: `rg -n "Ask|ask|frontend-logic-design|state|adapter|anti-pattern|checklist" .agents/skills/frontend-development .agents/skills/backend-development`

Expected: both skill packages expose ask-first gates, maintenance rules, and references for checklists and anti-patterns.

- [x] **Step 2: Read both skill entry files together**

Run: `sed -n '1,220p' .agents/skills/frontend-development/SKILL.md && printf '\n---\n' && sed -n '1,240p' .agents/skills/backend-development/SKILL.md`

Expected: the two skills feel parallel in structure, but not duplicated in scope.

- [x] **Step 3: Confirm the file layout stays within repo rules**

Run: `find .agents/skills/frontend-development -maxdepth 2 -type f | sort && printf '\n---\n' && find .agents/skills/backend-development -maxdepth 2 -type f | sort`

Expected: each skill directory remains focused, with one `SKILL.md` and a small `references/` set.

- [x] **Step 4: Commit the skill implementation**

Run:

```bash
git add .agents/skills/frontend-development .agents/skills/backend-development docs/superpowers/plans/2026-04-11-development-skills.md
git commit -m "docs: add frontend and backend development skills"
```

Expected: a clean commit containing the two new skill packages and the implementation plan.
