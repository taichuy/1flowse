# HostExtension Boot Loader Policy Lifecycle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现 HostExtension 的 boot-time 发现、依赖排序、deployment policy、override policy 和 health/safe mode 骨架。

**Architecture:** 在 `control-plane` 建立纯函数 policy 与 loader plan，先不做真实动态加载。`api-server` 启动时调用内置 manifest provider，生成 registry 和 inventory；失败按 policy 标记 unhealthy，不进入普通 runtime extension enable 流程。

**Tech Stack:** Rust 2021、Serde、Tokio、Axum startup assembly、SQLx/PostgreSQL

---

## File Structure

- Create: `api/crates/control-plane/src/host_extension_boot/mod.rs`
- Create: `api/crates/control-plane/src/host_extension_boot/policy.rs`
- Create: `api/crates/control-plane/src/host_extension_boot/loader.rs`
- Create: `api/crates/control-plane/src/_tests/host_extension_boot_tests.rs`
- Modify: `api/crates/control-plane/src/_tests/mod.rs`
- Modify: `api/crates/control-plane/src/lib.rs`
- Modify: `api/apps/api-server/src/lib.rs`
- Create: `api/apps/api-server/src/host_extension_boot.rs`
- Create: `api/apps/api-server/src/_tests/host_extension_boot_tests.rs`

### Task 1: Add Deployment Policy Types

**Files:**
- Create: `api/crates/control-plane/src/host_extension_boot/policy.rs`
- Create: `api/crates/control-plane/src/host_extension_boot/mod.rs`
- Modify: `api/crates/control-plane/src/lib.rs`
- Create: `api/crates/control-plane/src/_tests/host_extension_boot_tests.rs`
- Modify: `api/crates/control-plane/src/_tests/mod.rs`

- [x] **Step 1: Write failing policy tests**

Create `api/crates/control-plane/src/_tests/host_extension_boot_tests.rs`:

```rust
use control_plane::host_extension_boot::{
    evaluate_host_extension_policy, HostExtensionBootFailurePolicy, HostExtensionDeploymentPolicy,
    HostExtensionPolicyInput,
};

#[test]
fn policy_rejects_uploaded_host_extension_when_disabled() {
    let policy = HostExtensionDeploymentPolicy {
        allowed_sources: vec!["builtin".into(), "filesystem_dropin".into()],
        allow_uploaded_host_extension: false,
        allow_contract_override: vec!["storage-ephemeral".into()],
        deny_contract_override: vec!["identity".into()],
        boot_failure_policy: HostExtensionBootFailurePolicy::Unhealthy,
    };

    let error = evaluate_host_extension_policy(
        &policy,
        &HostExtensionPolicyInput {
            extension_id: "custom.uploaded-host".into(),
            source_kind: "uploaded".into(),
            overrides_contracts: vec![],
        },
    )
    .expect_err("uploaded host extension should be rejected");

    assert!(error.to_string().contains("uploaded"));
}

#[test]
fn policy_rejects_denied_contract_override() {
    let policy = HostExtensionDeploymentPolicy {
        allowed_sources: vec!["builtin".into()],
        allow_uploaded_host_extension: false,
        allow_contract_override: vec!["storage-ephemeral".into()],
        deny_contract_override: vec!["identity".into()],
        boot_failure_policy: HostExtensionBootFailurePolicy::Unhealthy,
    };

    let error = evaluate_host_extension_policy(
        &policy,
        &HostExtensionPolicyInput {
            extension_id: "custom.identity-host".into(),
            source_kind: "builtin".into(),
            overrides_contracts: vec!["identity".into()],
        },
    )
    .expect_err("identity override should be rejected");

    assert!(error.to_string().contains("identity"));
}
```

- [x] **Step 2: Run failing tests**

Run:

```bash
cargo test -p control-plane host_extension_boot_tests
```

Expected:

```text
unresolved import `control_plane::host_extension_boot`
```

- [x] **Step 3: Implement policy module**

Create `api/crates/control-plane/src/host_extension_boot/mod.rs`:

```rust
pub mod loader;
pub mod policy;

pub use loader::{build_host_extension_load_plan, HostExtensionLoadPlanItem};
pub use policy::{
    evaluate_host_extension_policy, HostExtensionBootFailurePolicy,
    HostExtensionDeploymentPolicy, HostExtensionPolicyInput,
};
```

Create `api/crates/control-plane/src/host_extension_boot/policy.rs`:

```rust
use crate::errors::ControlPlaneError;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum HostExtensionBootFailurePolicy {
    Unhealthy,
    SafeMode,
    Abort,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct HostExtensionDeploymentPolicy {
    pub allowed_sources: Vec<String>,
    pub allow_uploaded_host_extension: bool,
    pub allow_contract_override: Vec<String>,
    pub deny_contract_override: Vec<String>,
    pub boot_failure_policy: HostExtensionBootFailurePolicy,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct HostExtensionPolicyInput {
    pub extension_id: String,
    pub source_kind: String,
    pub overrides_contracts: Vec<String>,
}

pub fn evaluate_host_extension_policy(
    policy: &HostExtensionDeploymentPolicy,
    input: &HostExtensionPolicyInput,
) -> anyhow::Result<()> {
    if input.source_kind == "uploaded" && !policy.allow_uploaded_host_extension {
        return Err(ControlPlaneError::PermissionDenied("uploaded_host_extension").into());
    }
    if !policy.allowed_sources.iter().any(|source| source == &input.source_kind) {
        return Err(ControlPlaneError::PermissionDenied("host_extension_source").into());
    }
    for contract in &input.overrides_contracts {
        if policy.deny_contract_override.iter().any(|item| item == contract) {
            return Err(ControlPlaneError::PermissionDenied("host_contract_override").into());
        }
        if !policy.allow_contract_override.iter().any(|item| item == contract) {
            return Err(ControlPlaneError::PermissionDenied("host_contract_override").into());
        }
    }
    Ok(())
}
```

Modify `api/crates/control-plane/src/lib.rs`:

```rust
pub mod host_extension_boot;
```

- [x] **Step 4: Run tests**

Run:

```bash
cargo test -p control-plane host_extension_boot_tests
```

Expected:

```text
test result: ok
```

### Task 2: Add Deterministic Load Plan

**Files:**
- Create: `api/crates/control-plane/src/host_extension_boot/loader.rs`
- Modify: `api/crates/control-plane/src/_tests/host_extension_boot_tests.rs`

- [x] **Step 1: Add failing load order tests**

Append to `api/crates/control-plane/src/_tests/host_extension_boot_tests.rs`:

```rust
use control_plane::host_extension_boot::{build_host_extension_load_plan, HostExtensionLoadPlanItem};

#[test]
fn load_plan_sorts_by_declared_dependencies() {
    let plan = build_host_extension_load_plan(vec![
        HostExtensionLoadPlanItem {
            extension_id: "official.data-access-host".into(),
            after: vec!["official.storage-host".into()],
        },
        HostExtensionLoadPlanItem {
            extension_id: "official.storage-host".into(),
            after: vec![],
        },
    ])
    .expect("load plan should sort");

    assert_eq!(plan[0].extension_id, "official.storage-host");
    assert_eq!(plan[1].extension_id, "official.data-access-host");
}

#[test]
fn load_plan_rejects_missing_dependency() {
    let error = build_host_extension_load_plan(vec![HostExtensionLoadPlanItem {
        extension_id: "official.data-access-host".into(),
        after: vec!["official.storage-host".into()],
    }])
    .expect_err("missing dependency should fail");

    assert!(error.to_string().contains("official.storage-host"));
}
```

- [x] **Step 2: Run failing test**

Run:

```bash
cargo test -p control-plane load_plan_sorts_by_declared_dependencies load_plan_rejects_missing_dependency
```

Expected:

```text
unresolved import or failing assertion
```

- [x] **Step 3: Implement load planner**

Create `api/crates/control-plane/src/host_extension_boot/loader.rs`:

```rust
use std::collections::{BTreeMap, BTreeSet};

use crate::errors::ControlPlaneError;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct HostExtensionLoadPlanItem {
    pub extension_id: String,
    pub after: Vec<String>,
}

pub fn build_host_extension_load_plan(
    items: Vec<HostExtensionLoadPlanItem>,
) -> anyhow::Result<Vec<HostExtensionLoadPlanItem>> {
    let by_id = items
        .into_iter()
        .map(|item| (item.extension_id.clone(), item))
        .collect::<BTreeMap<_, _>>();
    let mut resolved = Vec::new();
    let mut visited = BTreeSet::new();
    let mut visiting = BTreeSet::new();

    for id in by_id.keys() {
        visit(id, &by_id, &mut visiting, &mut visited, &mut resolved)?;
    }

    Ok(resolved)
}

fn visit(
    id: &str,
    by_id: &BTreeMap<String, HostExtensionLoadPlanItem>,
    visiting: &mut BTreeSet<String>,
    visited: &mut BTreeSet<String>,
    resolved: &mut Vec<HostExtensionLoadPlanItem>,
) -> anyhow::Result<()> {
    if visited.contains(id) {
        return Ok(());
    }
    if !visiting.insert(id.to_string()) {
        return Err(ControlPlaneError::Conflict("host_extension_dependency_cycle").into());
    }
    let item = by_id
        .get(id)
        .ok_or(ControlPlaneError::NotFound("host_extension_dependency"))?;
    for dependency in &item.after {
        if !by_id.contains_key(dependency) {
            return Err(ControlPlaneError::NotFound("host_extension_dependency").into());
        }
        visit(dependency, by_id, visiting, visited, resolved)?;
    }
    visiting.remove(id);
    visited.insert(id.to_string());
    resolved.push(item.clone());
    Ok(())
}
```

- [x] **Step 4: Run tests**

Run:

```bash
cargo test -p control-plane load_plan
```

Expected:

```text
test result: ok
```

### Task 3: Wire Api-Server Boot Assembly Skeleton

**Files:**
- Create: `api/apps/api-server/src/host_extension_boot.rs`
- Modify: `api/apps/api-server/src/lib.rs`
- Create: `api/apps/api-server/src/_tests/host_extension_boot_tests.rs`

- [x] **Step 1: Write route-host assembly test**

Create `api/apps/api-server/src/_tests/host_extension_boot_tests.rs`:

```rust
use api_server::host_extension_boot::builtin_host_extension_ids;

#[test]
fn builtin_host_extensions_include_storage_data_file_and_model_runtime() {
    let ids = builtin_host_extension_ids();
    assert!(ids.contains(&"official.storage-host"));
    assert!(ids.contains(&"official.data-access-host"));
    assert!(ids.contains(&"official.file-management-host"));
    assert!(ids.contains(&"official.model-runtime-host"));
}
```

Ensure `api/apps/api-server/src/_tests/mod.rs` includes:

```rust
mod host_extension_boot_tests;
```

- [x] **Step 2: Run failing test**

Run:

```bash
cargo test -p api-server builtin_host_extensions_include_storage_data_file_and_model_runtime
```

Expected:

```text
unresolved import `api_server::host_extension_boot`
```

- [x] **Step 3: Add boot module**

Create `api/apps/api-server/src/host_extension_boot.rs`:

```rust
pub fn builtin_host_extension_ids() -> Vec<&'static str> {
    vec![
        "official.identity-host",
        "official.workspace-host",
        "official.plugin-host",
        "official.storage-host",
        "official.model-runtime-host",
        "official.data-access-host",
        "official.file-management-host",
        "official.runtime-orchestration-host",
        "official.observability-host",
    ]
}
```

Modify `api/apps/api-server/src/lib.rs`:

```rust
pub mod host_extension_boot;
```

- [x] **Step 4: Run tests**

Run:

```bash
cargo test -p api-server builtin_host_extensions_include_storage_data_file_and_model_runtime
```

Expected:

```text
test result: ok
```

### Task 4: Commit

**Files:**
- All files listed in this plan

- [x] **Step 1: Run focused tests**

Run:

```bash
cargo test -p control-plane host_extension_boot_tests
cargo test -p api-server builtin_host_extensions_include_storage_data_file_and_model_runtime
```

Expected:

```text
test result: ok
```

- [x] **Step 2: Commit**

Run:

```bash
git add api/crates/control-plane/src api/apps/api-server/src
git commit -m "feat: add host extension boot policy"
```

Expected:

```text
[project-maintenance <sha>] feat: add host extension boot policy
```
