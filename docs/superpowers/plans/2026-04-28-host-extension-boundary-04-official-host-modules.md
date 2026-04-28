# Official Host Modules Storage Data File Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 storage、data access、file management、model runtime 等官方能力面注册为内置 HostExtension。

**Architecture:** 在 `api-server` 提供内置 HostExtension manifest source，在 `control-plane` 生成 registry/inventory。现阶段不物理拆 crate，只先让官方 host modules 作为声明式能力面存在，并把 `storage-durable / storage-ephemeral / storage-object` 归入 `official.storage-host` 管理。

**Tech Stack:** Rust 2021、Serde YAML、SQLx/PostgreSQL、cargo test

---

## File Structure

- Create: `api/apps/api-server/src/host_extensions/mod.rs`
- Create: `api/apps/api-server/src/host_extensions/builtin.rs`
- Modify: `api/apps/api-server/src/lib.rs`
- Create: `api/apps/api-server/src/_tests/host_extensions_builtin_tests.rs`
- Modify: `api/apps/api-server/src/_tests/mod.rs`
- Create: `api/crates/control-plane/src/host_extension_boot/builtin.rs`
- Modify: `api/crates/control-plane/src/host_extension_boot/mod.rs`
- Create: `api/crates/control-plane/src/_tests/host_extension_builtin_tests.rs`
- Modify: `api/crates/control-plane/src/_tests/mod.rs`

### Task 1: Define Builtin HostExtension Manifests

**Files:**
- Create: `api/apps/api-server/src/host_extensions/mod.rs`
- Create: `api/apps/api-server/src/host_extensions/builtin.rs`
- Modify: `api/apps/api-server/src/lib.rs`
- Create: `api/apps/api-server/src/_tests/host_extensions_builtin_tests.rs`
- Modify: `api/apps/api-server/src/_tests/mod.rs`

- [ ] **Step 1: Write failing manifest source tests**

Create `api/apps/api-server/src/_tests/host_extensions_builtin_tests.rs`:

```rust
use api_server::host_extensions::builtin::builtin_host_extension_manifests;
use plugin_framework::parse_host_extension_manifest;

#[test]
fn storage_host_registers_all_storage_contracts() {
    let manifests = builtin_host_extension_manifests();
    let storage = manifests
        .iter()
        .find(|raw| raw.contains("extension_id: official.storage-host"))
        .expect("storage-host manifest should exist");
    let manifest = parse_host_extension_manifest(storage).expect("storage manifest should parse");

    assert!(manifest.provides_contracts.contains(&"storage-durable".to_string()));
    assert!(manifest.provides_contracts.contains(&"storage-ephemeral".to_string()));
    assert!(manifest.provides_contracts.contains(&"storage-object".to_string()));
    assert!(manifest.registers_storage.iter().any(|entry| {
        entry.kind == "storage-durable" && entry.implementation == "postgres"
    }));
}

#[test]
fn data_and_file_hosts_register_runtime_slots() {
    let manifests = builtin_host_extension_manifests();
    let parsed = manifests
        .iter()
        .map(|raw| parse_host_extension_manifest(raw).expect("manifest should parse"))
        .collect::<Vec<_>>();

    let data_access = parsed
        .iter()
        .find(|manifest| manifest.extension_id == "official.data-access-host")
        .expect("data-access-host should exist");
    assert!(data_access.registers_slots.contains(&"data_source".to_string()));

    let file_management = parsed
        .iter()
        .find(|manifest| manifest.extension_id == "official.file-management-host")
        .expect("file-management-host should exist");
    assert!(file_management.registers_slots.contains(&"file_processor".to_string()));
}
```

- [ ] **Step 2: Run failing tests**

Run:

```bash
cargo test -p api-server storage_host_registers_all_storage_contracts data_and_file_hosts_register_runtime_slots
```

Expected:

```text
unresolved import `api_server::host_extensions`
```

- [ ] **Step 3: Add builtin manifests**

Create `api/apps/api-server/src/host_extensions/mod.rs`:

```rust
pub mod builtin;
```

Create `api/apps/api-server/src/host_extensions/builtin.rs`:

```rust
pub fn builtin_host_extension_manifests() -> Vec<&'static str> {
    vec![
        IDENTITY_HOST,
        WORKSPACE_HOST,
        PLUGIN_HOST,
        STORAGE_HOST,
        MODEL_RUNTIME_HOST,
        DATA_ACCESS_HOST,
        FILE_MANAGEMENT_HOST,
        RUNTIME_ORCHESTRATION_HOST,
        OBSERVABILITY_HOST,
    ]
}

const IDENTITY_HOST: &str = r#"
manifest_version: 1
extension_id: official.identity-host
version: 0.1.0
display_name: Identity Host
source_kind: builtin
trust_level: trusted_host
activation_phase: boot
provides_contracts: [identity]
overrides_contracts: []
registers_slots: []
registers_interfaces: []
registers_storage: []
dependencies: []
load_order: { after: [], before: [] }
"#;

const WORKSPACE_HOST: &str = r#"
manifest_version: 1
extension_id: official.workspace-host
version: 0.1.0
display_name: Workspace Host
source_kind: builtin
trust_level: trusted_host
activation_phase: boot
provides_contracts: [workspace]
overrides_contracts: []
registers_slots: []
registers_interfaces: []
registers_storage: []
dependencies:
  - { extension_id: official.identity-host, version_range: ">=0.1.0" }
load_order: { after: [official.identity-host], before: [] }
"#;

const PLUGIN_HOST: &str = r#"
manifest_version: 1
extension_id: official.plugin-host
version: 0.1.0
display_name: Plugin Host
source_kind: builtin
trust_level: trusted_host
activation_phase: boot
provides_contracts: [plugin_management]
overrides_contracts: []
registers_slots: []
registers_interfaces: []
registers_storage: []
dependencies:
  - { extension_id: official.identity-host, version_range: ">=0.1.0" }
load_order: { after: [official.identity-host], before: [] }
"#;

const STORAGE_HOST: &str = r#"
manifest_version: 1
extension_id: official.storage-host
version: 0.1.0
display_name: Storage Host
source_kind: builtin
trust_level: trusted_host
activation_phase: boot
provides_contracts: [storage-durable, storage-ephemeral, storage-object]
overrides_contracts: []
registers_slots: []
registers_interfaces:
  - { code: storage.health, kind: internal_service }
registers_storage:
  - { kind: storage-durable, implementation: postgres }
  - { kind: storage-ephemeral, implementation: memory }
  - { kind: storage-object, implementation: local }
dependencies:
  - { extension_id: official.plugin-host, version_range: ">=0.1.0" }
load_order: { after: [official.plugin-host], before: [] }
"#;

const MODEL_RUNTIME_HOST: &str = r#"
manifest_version: 1
extension_id: official.model-runtime-host
version: 0.1.0
display_name: Model Runtime Host
source_kind: builtin
trust_level: trusted_host
activation_phase: boot
provides_contracts: [model_runtime]
overrides_contracts: []
registers_slots: [model_provider, embedding_provider, reranker_provider]
registers_interfaces: []
registers_storage: []
dependencies:
  - { extension_id: official.plugin-host, version_range: ">=0.1.0" }
load_order: { after: [official.plugin-host], before: [] }
"#;

const DATA_ACCESS_HOST: &str = r#"
manifest_version: 1
extension_id: official.data-access-host
version: 0.1.0
display_name: Data Access Host
source_kind: builtin
trust_level: trusted_host
activation_phase: boot
provides_contracts: [data_access]
overrides_contracts: []
registers_slots: [data_source, data_import_snapshot]
registers_interfaces: []
registers_storage: []
dependencies:
  - { extension_id: official.storage-host, version_range: ">=0.1.0" }
load_order: { after: [official.storage-host], before: [] }
"#;

const FILE_MANAGEMENT_HOST: &str = r#"
manifest_version: 1
extension_id: official.file-management-host
version: 0.1.0
display_name: File Management Host
source_kind: builtin
trust_level: trusted_host
activation_phase: boot
provides_contracts: [file_management]
overrides_contracts: []
registers_slots: [file_processor]
registers_interfaces: []
registers_storage: []
dependencies:
  - { extension_id: official.storage-host, version_range: ">=0.1.0" }
load_order: { after: [official.storage-host], before: [] }
"#;

const RUNTIME_ORCHESTRATION_HOST: &str = r#"
manifest_version: 1
extension_id: official.runtime-orchestration-host
version: 0.1.0
display_name: Runtime Orchestration Host
source_kind: builtin
trust_level: trusted_host
activation_phase: boot
provides_contracts: [runtime_orchestration]
overrides_contracts: []
registers_slots: []
registers_interfaces: []
registers_storage: []
dependencies:
  - { extension_id: official.model-runtime-host, version_range: ">=0.1.0" }
load_order: { after: [official.model-runtime-host], before: [] }
"#;

const OBSERVABILITY_HOST: &str = r#"
manifest_version: 1
extension_id: official.observability-host
version: 0.1.0
display_name: Observability Host
source_kind: builtin
trust_level: trusted_host
activation_phase: boot
provides_contracts: [observability]
overrides_contracts: []
registers_slots: []
registers_interfaces: []
registers_storage: []
dependencies:
  - { extension_id: official.storage-host, version_range: ">=0.1.0" }
load_order: { after: [official.storage-host], before: [] }
"#;
```

Modify `api/apps/api-server/src/lib.rs`:

```rust
pub mod host_extensions;
```

- [ ] **Step 4: Run tests**

Run:

```bash
cargo test -p api-server storage_host_registers_all_storage_contracts data_and_file_hosts_register_runtime_slots
```

Expected:

```text
test result: ok
```

### Task 2: Convert Builtin Manifests Into Registry

**Files:**
- Create: `api/crates/control-plane/src/host_extension_boot/builtin.rs`
- Modify: `api/crates/control-plane/src/host_extension_boot/mod.rs`
- Create: `api/crates/control-plane/src/_tests/host_extension_builtin_tests.rs`
- Modify: `api/crates/control-plane/src/_tests/mod.rs`

- [ ] **Step 1: Write failing registry build test**

Create `api/crates/control-plane/src/_tests/host_extension_builtin_tests.rs`:

```rust
use control_plane::host_extension_boot::register_builtin_host_extensions;
use plugin_framework::{parse_host_extension_manifest, HostExtensionRegistry};

#[test]
fn builtin_manifests_populate_contract_slot_and_storage_registry() {
    let manifests = vec![
        r#"
manifest_version: 1
extension_id: official.storage-host
version: 0.1.0
display_name: Storage Host
source_kind: builtin
trust_level: trusted_host
activation_phase: boot
provides_contracts: [storage-durable, storage-ephemeral, storage-object]
overrides_contracts: []
registers_slots: []
registers_interfaces: []
registers_storage:
  - { kind: storage-durable, implementation: postgres }
  - { kind: storage-ephemeral, implementation: memory }
dependencies: []
load_order: { after: [], before: [] }
"#,
        r#"
manifest_version: 1
extension_id: official.data-access-host
version: 0.1.0
display_name: Data Access Host
source_kind: builtin
trust_level: trusted_host
activation_phase: boot
provides_contracts: [data_access]
overrides_contracts: []
registers_slots: [data_source]
registers_interfaces: []
registers_storage: []
dependencies: []
load_order: { after: [], before: [] }
"#,
    ];
    let parsed = manifests
        .into_iter()
        .map(|raw| parse_host_extension_manifest(raw).unwrap())
        .collect::<Vec<_>>();
    let registry = register_builtin_host_extensions(&parsed).expect("registry should build");

    assert_eq!(registry.contract_provider("storage-durable"), Some("official.storage-host"));
    assert_eq!(registry.storage_implementation("storage-durable"), Some("postgres"));
    assert_eq!(registry.slot_provider("data_source"), Some("official.data-access-host"));
}
```

- [ ] **Step 2: Run failing test**

Run:

```bash
cargo test -p control-plane builtin_manifests_populate_contract_slot_and_storage_registry
```

Expected:

```text
unresolved import `register_builtin_host_extensions`
```

- [ ] **Step 3: Implement registry builder**

Create `api/crates/control-plane/src/host_extension_boot/builtin.rs`:

```rust
use plugin_framework::{
    HostExtensionManifestV1, HostExtensionRegistry, RegisteredHostExtension,
};

pub fn register_builtin_host_extensions(
    manifests: &[HostExtensionManifestV1],
) -> anyhow::Result<HostExtensionRegistry> {
    let mut registry = HostExtensionRegistry::default();
    for manifest in manifests {
        registry.register(RegisteredHostExtension {
            extension_id: manifest.extension_id.clone(),
            provides_contracts: manifest.provides_contracts.clone(),
            overrides_contracts: manifest.overrides_contracts.clone(),
            registers_slots: manifest.registers_slots.clone(),
            registers_storage: manifest
                .registers_storage
                .iter()
                .map(|entry| (entry.kind.clone(), entry.implementation.clone()))
                .collect(),
        })?;
    }
    Ok(registry)
}
```

Modify `api/crates/control-plane/src/host_extension_boot/mod.rs`:

```rust
pub mod builtin;

pub use builtin::register_builtin_host_extensions;
```

- [ ] **Step 4: Run tests**

Run:

```bash
cargo test -p control-plane builtin_manifests_populate_contract_slot_and_storage_registry
```

Expected:

```text
test result: ok
```

### Task 3: Document Official Host Module Ownership

**Files:**
- Modify: `docs/superpowers/specs/2026-04-23-storage-durable-and-external-data-source-platform-design.md`
- Modify: `docs/superpowers/specs/2026-04-23-file-manager-storage-design.md`

- [ ] **Step 1: Add storage-host ownership note**

In `docs/superpowers/specs/2026-04-23-storage-durable-and-external-data-source-platform-design.md`, add after `## 总体架构`:

```markdown
> 2026-04-28 HostExtension 更新：`storage-durable` 与 `storage-ephemeral` 保持原命名，并归入 `official.storage-host` 的 host contract 管理。主仓官方仍只维护 PostgreSQL durable implementation；自托管部署可以通过 HostExtension 注册其他 implementation，但不进入官方支持矩阵。
```

- [ ] **Step 2: Add file-management-host ownership note**

In `docs/superpowers/specs/2026-04-23-file-manager-storage-design.md`, add after `## 总体架构`:

```markdown
> 2026-04-28 HostExtension 更新：文件管理归入 `official.file-management-host`。`storage-object` implementation 由 host 级注册，workspace 只能消费有权限的文件表和文件记录，不能安装或切换系统对象存储实现。
```

- [ ] **Step 3: Verify notes**

Run:

```bash
rg -n "official\\.storage-host|official\\.file-management-host|HostExtension 更新" docs/superpowers/specs/2026-04-23-storage-durable-and-external-data-source-platform-design.md docs/superpowers/specs/2026-04-23-file-manager-storage-design.md
```

Expected:

```text
docs/superpowers/specs/2026-04-23-storage-durable-and-external-data-source-platform-design.md
docs/superpowers/specs/2026-04-23-file-manager-storage-design.md
```

### Task 4: Commit

**Files:**
- All files listed in this plan

- [ ] **Step 1: Run focused tests**

Run:

```bash
cargo test -p api-server host_extensions_builtin
cargo test -p control-plane host_extension_builtin
```

Expected:

```text
test result: ok
```

- [ ] **Step 2: Commit**

Run:

```bash
git add api/apps/api-server/src api/crates/control-plane/src docs/superpowers/specs/2026-04-23-storage-durable-and-external-data-source-platform-design.md docs/superpowers/specs/2026-04-23-file-manager-storage-design.md
git commit -m "feat: register official host modules"
```

Expected:

```text
[project-maintenance <sha>] feat: register official host modules
```
