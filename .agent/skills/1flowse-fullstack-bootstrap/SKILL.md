---
name: 1flowse-fullstack-bootstrap
description: Use when working inside the 1Flowse repository and changing the web pnpm workspace, the api Rust workspace, local bootstrap commands, or the health/OpenAPI skeleton.
---

# 1Flowse Fullstack Bootstrap

## Overview

This skill captures the repo-specific bootstrap rules for 1Flowse. Use it whenever the task touches project structure, local run commands, shared frontend packages, Rust services, or OpenAPI bootstrap wiring.

## Repo Rules

- Frontend root is `web/`.
- Frontend package management stays inside `web/`; do not recreate `pnpm`, `node_modules`, or frontend config in the repo root.
- Frontend app lives in `web/app`.
- Frontend shared packages live in `web/packages/*`.
- Backend root is `api/`.
- Backend services live in `api/apps/*`.
- Backend shared crates live in `api/crates/*`.
- OpenAPI exposure stays on `api/apps/api-server`.

## Versions

- Node: `22`
- pnpm: `10`
- Rust toolchain: `stable`

## Commands

- Frontend install: `cd web && pnpm install`
- Frontend dev: `cd web && pnpm dev`
- Frontend dev fallback: `cd web && pnpm dev -- --port 5174`
- Frontend verify: `cd web && pnpm lint && pnpm test && pnpm build`
- API dev: `cd api && cargo run -p api-server`
- Runner dev: `cd api && cargo run -p plugin-runner`
- Backend verify: `cd api && cargo fmt --check && cargo clippy --all-targets --all-features -- -D warnings && cargo test`

Read `references/commands.md` before changing run flows, verification commands, or local URL conventions.

## Network

If frontend dependency download fails, retry with:

`HTTP_PROXY=http://192.168.92.1:1454 HTTPS_PROXY=http://192.168.92.1:1454`
