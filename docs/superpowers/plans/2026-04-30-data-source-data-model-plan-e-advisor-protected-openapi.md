# Data Source Data Model Plan E Advisor Protected OpenAPI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add protected Data Models, Data Model Advisor findings, and dynamic API documentation so unsafe configurations are visible and blockable.

**Architecture:** Protected-model rules are enforcement, Advisor is analysis, and API docs are read-only developer experience. Advisor can block publish/exposure transitions but does not own the core permission truth.

**Tech Stack:** Rust, control-plane services, Axum settings/model routes, OpenAPI docs support, audit logs.

---

## File Structure

**Modify**
- `api/crates/domain/src/modeling.rs`: protected model and Advisor finding types.
- `api/crates/control-plane/src/model_definition.rs`: protected model enforcement and Advisor service.
- `api/crates/control-plane/src/ports/model_definition.rs`: Advisor repository methods if findings persist.
- `api/crates/storage-durable/postgres/src/model_definition_repository/*`: protected/finding persistence if persisted.
- `api/apps/api-server/src/routes/plugins_and_models/model_definitions.rs`: Advisor and protected route DTOs.
- `api/apps/api-server/src/openapi.rs`: dynamic runtime CRUD docs entry.
- `api/apps/api-server/src/_tests/openapi_alignment.rs`: docs alignment tests.

### Task 1: Protected Data Model Enforcement

**Files:**
- Modify: `api/crates/control-plane/src/model_definition.rs`
- Test: `api/crates/control-plane/src/_tests/model_definition_service_tests.rs`
- Test: `api/apps/api-server/src/_tests/application/model_definition_routes.rs`

- [ ] **Step 1: Write failing tests**

Cover protected models cannot be:

```text
deleted by normal admin
field-deleted by normal admin
directly API exposed by normal admin
changed from extension-owned to core-owned
published with owner/scope bypass
```

- [ ] **Step 2: Implement enforcement**

Check `is_protected`, `owner_kind`, and actor privilege in control-plane commands before repository writes.

- [ ] **Step 3: Run tests**

```bash
cargo test --manifest-path api/Cargo.toml -p control-plane model_definition_service_tests
cargo test --manifest-path api/Cargo.toml -p api-server model_definition_routes
```

### Task 2: Data Model Advisor

**Files:**
- Modify: `api/crates/domain/src/modeling.rs`
- Modify: `api/crates/control-plane/src/model_definition.rs`
- Test: `api/crates/control-plane/src/_tests/model_definition_service_tests.rs`

- [ ] **Step 1: Write failing Advisor tests**

Findings must include:

```text
published_not_exposed info
api_exposed_no_permission high
unsafe_external_source blocking
missing audit for write API high
missing scope filter blocking
protected model exposure attempt blocking
duplicate or risky field configuration medium
```

- [ ] **Step 2: Implement Advisor service**

Return:

```text
id
data_model_id
severity: blocking/high/medium/info
code
message
recommended_action
can_acknowledge
```

- [ ] **Step 3: Wire blocking behavior**

Blocking/high findings must either block status/exposure transition or require explicit acknowledgement where the spec allows it.

- [ ] **Step 4: Run tests**

```bash
cargo test --manifest-path api/Cargo.toml -p control-plane model_definition_service_tests
```

### Task 3: Dynamic API Documentation

**Files:**
- Modify: `api/apps/api-server/src/openapi.rs`
- Modify: `api/apps/api-server/src/routes/settings/docs.rs`
- Modify: `api/apps/api-server/src/routes/plugins_and_models/model_definitions.rs`
- Test: `api/apps/api-server/src/_tests/openapi_alignment.rs`
- Test: `api/apps/api-server/src/_tests/openapi_docs_tests.rs`

- [ ] **Step 1: Write failing docs tests**

Docs must expose per Data Model:

```text
CRUD endpoint
field schema
filter/sort/expand examples
API Key usage
scope permission note
error codes
API exposure status
external source safety limits
```

- [ ] **Step 2: Implement docs response**

Start with runtime generic schema plus Data Model-specific field metadata. Do not generate one static OpenAPI file per model.

- [ ] **Step 3: Run docs tests**

```bash
cargo test --manifest-path api/Cargo.toml -p api-server openapi_alignment openapi_docs_tests
```

### Task 4: Plan E Verification And Commit

- [ ] **Step 1: Format**

```bash
cargo fmt --manifest-path api/Cargo.toml
```

- [ ] **Step 2: Targeted regression**

```bash
cargo test --manifest-path api/Cargo.toml -p control-plane model_definition_service_tests
cargo test --manifest-path api/Cargo.toml -p api-server model_definition_routes openapi_alignment openapi_docs_tests
```

- [ ] **Step 3: Commit**

```bash
git add api/crates/domain api/crates/control-plane api/crates/storage-durable/postgres api/apps/api-server
git commit -m "feat: add data model advisor and protected models"
```
