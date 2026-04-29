# Plugin Layering Host Extension Plan D Resource Action Kernel v1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Introduce Resource Action Kernel v1 and migrate `plugins.install` plus `files.upload` as the first governed Core actions.

**Architecture:** Add a `control-plane::resource_action` module with resource/action definitions, hook ordering, pipeline execution, audit/outbox integration points, and dispatch APIs. Existing service commands remain the truth-changing handlers; routes move from direct service calls to `resource_action_kernel.dispatch()` for the two selected actions.

**Tech Stack:** Rust, control-plane service layer, api-server routes, serde_json action payloads, targeted unit and route tests.

---

## File Structure

**Create**
- `api/crates/control-plane/src/resource_action/mod.rs`
- `api/crates/control-plane/src/resource_action/types.rs`
- `api/crates/control-plane/src/resource_action/registry.rs`
- `api/crates/control-plane/src/resource_action/pipeline.rs`
- `api/crates/control-plane/src/resource_action/kernel.rs`
- `api/crates/control-plane/src/_tests/resource_action_tests.rs`

**Modify**
- `api/crates/control-plane/src/lib.rs`
- `api/crates/control-plane/src/plugin_management/install.rs`
- `api/crates/control-plane/src/file_management/upload_service.rs`
- `api/apps/api-server/src/routes/plugins_and_models/plugins.rs`
- `api/apps/api-server/src/routes/files.rs`
- `api/apps/api-server/src/_tests/plugin_routes/install_and_access.rs`
- `api/apps/api-server/src/_tests/file_management_routes.rs`

### Task 1: Add Resource/Action Types And Registry

**Files:**
- Create: `api/crates/control-plane/src/resource_action/types.rs`
- Create: `api/crates/control-plane/src/resource_action/registry.rs`
- Create: `api/crates/control-plane/src/resource_action/mod.rs`
- Create: `api/crates/control-plane/src/_tests/resource_action_tests.rs`
- Modify: `api/crates/control-plane/src/lib.rs`
- Modify: `api/crates/control-plane/src/_tests/mod.rs`

- [x] **Step 1: Write RED registry tests**

Add tests:

```rust
use control_plane::resource_action::{
    ActionDefinition, ResourceActionRegistry, ResourceDefinition, ResourceOwnerKind, ResourceScopeKind,
};

#[test]
fn registry_rejects_duplicate_action() {
    let mut registry = ResourceActionRegistry::default();
    registry.register_resource(ResourceDefinition::core("plugins", ResourceScopeKind::System)).unwrap();
    registry.register_action(ActionDefinition::core("plugins", "install")).unwrap();

    let err = registry.register_action(ActionDefinition::core("plugins", "install")).unwrap_err();
    assert!(err.to_string().contains("duplicate action"));
}

#[test]
fn registry_requires_existing_resource() {
    let mut registry = ResourceActionRegistry::default();
    let err = registry.register_action(ActionDefinition::core("files", "upload")).unwrap_err();
    assert!(err.to_string().contains("resource not registered"));
}
```

- [x] **Step 2: Run RED verification**

Run:

```bash
cd api
cargo test -p control-plane resource_action -- --nocapture
```

Expected: FAIL because module does not exist.

- [x] **Step 3: Implement registry**

Create:

```rust
pub enum ResourceOwnerKind { Core, HostExtension }
pub enum ResourceScopeKind { System, Workspace }
pub struct ResourceDefinition { pub code: String, pub owner_kind: ResourceOwnerKind, pub owner_id: String, pub scope_kind: ResourceScopeKind }
pub struct ActionDefinition { pub resource_code: String, pub action_code: String, pub owner_kind: ResourceOwnerKind }
```

Implement:

```rust
ResourceDefinition::core(code, scope_kind)
ActionDefinition::core(resource_code, action_code)
ResourceActionRegistry::register_resource
ResourceActionRegistry::register_action
ResourceActionRegistry::action(resource_code, action_code)
```

- [x] **Step 4: Re-run registry tests**

Run:

```bash
cd api
cargo test -p control-plane resource_action -- --nocapture
```

Expected: PASS.

- [x] **Step 5: Commit registry**

```bash
git add api/crates/control-plane/src/resource_action api/crates/control-plane/src/_tests/resource_action_tests.rs api/crates/control-plane/src/_tests/mod.rs api/crates/control-plane/src/lib.rs
git commit -m "feat: add resource action registry"
```

### Task 2: Add Hook Ordering And Pipeline Semantics

**Files:**
- Create: `api/crates/control-plane/src/resource_action/pipeline.rs`
- Modify: `api/crates/control-plane/src/resource_action/mod.rs`
- Modify: `api/crates/control-plane/src/_tests/resource_action_tests.rs`

- [x] **Step 1: Add RED hook ordering tests**

Test expected ordering:

```text
stage order first
priority ascending second
extension_id ascending third
hook_code ascending fourth
```

Add a failure test:

```text
before_execute hook returning deny stops execute and after_execute
after_commit error records warning without changing action result
```

- [x] **Step 2: Run RED verification**

Run:

```bash
cd api
cargo test -p control-plane resource_action -- --nocapture
```

Expected: FAIL because pipeline does not exist.

- [x] **Step 3: Implement pipeline**

Define stages:

```rust
pub enum ActionHookStage {
    BeforeValidate,
    BeforeAuthorize,
    BeforeExecute,
    AfterExecute,
    AfterCommit,
    OnFailed,
}
```

Define hook result:

```rust
pub enum ActionHookResult {
    Continue,
    Deny { code: String, message: String },
    Warning { code: String, message: String },
}
```

Implement deterministic sort and failure behavior in a pure testable function before wiring services.

- [x] **Step 4: Re-run tests**

Run:

```bash
cd api
cargo test -p control-plane resource_action -- --nocapture
```

Expected: PASS.

- [x] **Step 5: Commit pipeline**

```bash
git add api/crates/control-plane/src/resource_action api/crates/control-plane/src/_tests/resource_action_tests.rs
git commit -m "feat: add resource action hook pipeline"
```

### Task 3: Add Kernel Dispatch Shell

**Files:**
- Create: `api/crates/control-plane/src/resource_action/kernel.rs`
- Modify: `api/crates/control-plane/src/resource_action/mod.rs`
- Modify: `api/crates/control-plane/src/_tests/resource_action_tests.rs`

- [x] **Step 1: Write RED dispatch test**

Add a test registering `plugins.install` with a fake handler:

```rust
#[tokio::test]
async fn dispatch_calls_registered_core_handler() {
    let kernel = test_kernel_with_plugins_install_handler(|input| {
        assert_eq!(input["plugin_id"], "openai_compatible@0.3.18");
        serde_json::json!({"status": "installed"})
    });

    let output = kernel
        .dispatch_json("plugins", "install", serde_json::json!({"plugin_id": "openai_compatible@0.3.18"}))
        .await
        .unwrap();

    assert_eq!(output["status"], "installed");
}
```

- [x] **Step 2: Run RED verification**

Run:

```bash
cd api
cargo test -p control-plane resource_action -- --nocapture
```

Expected: FAIL because kernel dispatch does not exist.

- [x] **Step 3: Implement dispatch shell**

Implement:

```rust
pub async fn dispatch_json(
    &self,
    resource_code: &str,
    action_code: &str,
    input: serde_json::Value,
) -> Result<serde_json::Value, ControlPlaneError>
```

For v1, handler storage may be a boxed async function or enum-backed internal handlers. Keep public API narrow and avoid exposing repository impl.

- [x] **Step 4: Re-run dispatch tests**

Run:

```bash
cd api
cargo test -p control-plane resource_action -- --nocapture
```

Expected: PASS.

- [x] **Step 5: Commit kernel shell**

```bash
git add api/crates/control-plane/src/resource_action api/crates/control-plane/src/_tests/resource_action_tests.rs
git commit -m "feat: add resource action dispatch shell"
```

### Task 4: Migrate plugins.install

**Files:**
- Modify: `api/crates/control-plane/src/plugin_management/install.rs`
- Modify: `api/apps/api-server/src/routes/plugins_and_models/plugins.rs`
- Modify: `api/apps/api-server/src/_tests/plugin_routes/install_and_access.rs`

- [x] **Step 1: Add route regression expectation**

Extend plugin install route tests to assert the response still contains installation data and that invalid upload/trust cases still return their existing error codes.

- [x] **Step 2: Run baseline tests**

Run:

```bash
cd api
cargo test -p api-server plugin_routes -- --nocapture
```

Expected: PASS before migration, establishing baseline behavior.

- [x] **Step 3: Register Core action**

Register:

```text
Resource: plugins
Action: install
Owner: Core
Handler: existing PluginManagementService install command
```

The route must call:

```text
resource_action_kernel.dispatch_json("plugins", "install", input_json)
```

Do not remove `PluginManagementService`; it remains the handler.

- [x] **Step 4: Re-run plugin route tests**

Run:

```bash
cd api
cargo test -p api-server plugin_routes -- --nocapture
cargo test -p control-plane resource_action -- --nocapture
```

Expected: PASS.

- [x] **Step 5: Commit plugins.install migration**

```bash
git add api/crates/control-plane/src api/apps/api-server/src/routes/plugins_and_models/plugins.rs api/apps/api-server/src/_tests/plugin_routes/install_and_access.rs
git commit -m "feat: route plugin install through resource action kernel"
```

### Task 5: Migrate files.upload

**Files:**
- Modify: `api/crates/control-plane/src/file_management/upload_service.rs`
- Modify: `api/apps/api-server/src/routes/files.rs`
- Modify: `api/apps/api-server/src/_tests/file_management_routes.rs`

- [ ] **Step 1: Add route regression expectation**

Extend file upload route tests to assert:

```text
uploaded file still records storage_id
workspace context is required
file table binding behavior stays unchanged
```

- [ ] **Step 2: Run baseline tests**

Run:

```bash
cd api
cargo test -p api-server file_management_routes -- --nocapture
```

Expected: PASS before migration.

- [ ] **Step 3: Register Core action**

Register:

```text
Resource: files
Action: upload
Owner: Core
Handler: existing FileUploadService upload command
```

The route must call:

```text
resource_action_kernel.dispatch_json("files", "upload", input_json)
```

- [ ] **Step 4: Re-run file route tests**

Run:

```bash
cd api
cargo test -p api-server file_management_routes -- --nocapture
cargo test -p control-plane resource_action -- --nocapture
```

Expected: PASS.

- [ ] **Step 5: Commit files.upload migration**

```bash
git add api/crates/control-plane/src api/apps/api-server/src/routes/files.rs api/apps/api-server/src/_tests/file_management_routes.rs
git commit -m "feat: route file upload through resource action kernel"
```

### Task 6: Plan D Verification

**Files:**
- Verify only.

- [ ] **Step 1: Format**

Run:

```bash
cd api
cargo fmt
```

- [ ] **Step 2: Run focused tests**

Run:

```bash
cd api
cargo test -p control-plane resource_action -- --nocapture
cargo test -p api-server plugin_routes -- --nocapture
cargo test -p api-server file_management_routes -- --nocapture
```

Expected: PASS.

- [ ] **Step 3: Commit formatting if needed**

```bash
git add api
git commit -m "style: format resource action kernel"
```

Run this commit only if formatting changed files.
