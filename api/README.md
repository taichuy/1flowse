# API Workspace

## Module Map

- `apps/api-server`: Axum HTTP entrypoint for public, console, and runtime routes
- `crates/control-plane`: backend application services and permission-checked state transitions
- `crates/runtime-core`: runtime resource descriptors, registries, and capability slot engine
- `crates/storage-pg`: Postgres-backed repository implementations and migrations
- `crates/storage-ephemeral`: non-durable session and ephemeral coordination adapters

## Verification

Run from the repository root:

```bash
node scripts/node/verify-backend.js
```

The verification script caps `cargo` build and test concurrency at half of the machine's available CPU so full backend runs stay within a safer resource envelope by default.
