# HostExtension Manifest and Registry Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 新增 HostExtension manifest v1、registry、inventory domain，让 host 能力面有可测试的声明式事实源。

**Architecture:** 在 `plugin-framework` 定义 manifest parser 和 registry types，在 `domain` 定义 inventory record，在 `control-plane` 提供只读服务和 repository port。此阶段只落内存 registry 与 domain contract，不接真实 boot loader。

**Tech Stack:** Rust 2021、Serde YAML、Serde JSON、UUID v7、time、SQLx/PostgreSQL

---

## File Structure

- Create: `api/crates/plugin-framework/src/host_extension_manifest.rs`
- Create: `api/crates/plugin-framework/src/host_extension_registry.rs`
- Modify: `api/crates/plugin-framework/src/lib.rs`
- Create: `api/crates/plugin-framework/src/_tests/host_extension_manifest_tests.rs`
- Create: `api/crates/plugin-framework/src/_tests/host_extension_registry_tests.rs`
- Modify: `api/crates/plugin-framework/src/_tests/mod.rs`
- Create: `api/crates/domain/src/host_extension.rs`
- Modify: `api/crates/domain/src/lib.rs`
- Create: `api/crates/domain/src/_tests/host_extension_tests.rs`
- Modify: `api/crates/domain/src/_tests/mod.rs`
- Modify: `api/crates/control-plane/src/ports/plugin.rs`
- Create: `api/crates/control-plane/src/host_extension_inventory.rs`
- Modify: `api/crates/control-plane/src/lib.rs`

### Task 1: Add HostExtension Manifest Parser

**Files:**
- Create: `api/crates/plugin-framework/src/host_extension_manifest.rs`
- Modify: `api/crates/plugin-framework/src/lib.rs`
- Create: `api/crates/plugin-framework/src/_tests/host_extension_manifest_tests.rs`
- Modify: `api/crates/plugin-framework/src/_tests/mod.rs`

- [x] **Step 1: Write failing manifest parser tests**

Create `api/crates/plugin-framework/src/_tests/host_extension_manifest_tests.rs`:

```rust
use plugin_framework::{
    parse_host_extension_manifest, HostExtensionActivationPhase, HostExtensionSourceKind,
};

#[test]
fn host_extension_manifest_parses_storage_host() {
    let raw = r#"
manifest_version: 1
extension_id: official.storage-host
version: 0.1.0
display_name: Storage Host
source_kind: builtin
trust_level: trusted_host
activation_phase: boot
provides_contracts:
  - storage-durable
  - storage-ephemeral
  - storage-object
overrides_contracts: []
registers_slots: []
registers_interfaces:
  - code: storage.health
    kind: internal_service
registers_storage:
  - kind: storage-durable
    implementation: postgres
  - kind: storage-ephemeral
    implementation: memory
dependencies: []
load_order:
  after: []
  before:
    - official.data-access-host
"#;

    let manifest = parse_host_extension_manifest(raw).expect("manifest should parse");
    assert_eq!(manifest.extension_id, "official.storage-host");
    assert_eq!(manifest.source_kind, HostExtensionSourceKind::Builtin);
    assert_eq!(manifest.activation_phase, HostExtensionActivationPhase::Boot);
    assert_eq!(manifest.provides_contracts, vec!["storage-durable", "storage-ephemeral", "storage-object"]);
    assert_eq!(manifest.registers_storage[0].implementation, "postgres");
}

#[test]
fn host_extension_manifest_rejects_runtime_activation() {
    let raw = r#"
manifest_version: 1
extension_id: official.bad-host
version: 0.1.0
display_name: Bad Host
source_kind: builtin
trust_level: trusted_host
activation_phase: runtime
provides_contracts: []
overrides_contracts: []
registers_slots: []
registers_interfaces: []
registers_storage: []
dependencies: []
load_order:
  after: []
  before: []
"#;

    let error = parse_host_extension_manifest(raw).expect_err("runtime activation is invalid");
    assert!(error.to_string().contains("activation_phase"));
}
```

Modify `api/crates/plugin-framework/src/_tests/mod.rs`:

```rust
mod host_extension_manifest_tests;
```

Keep existing modules and insert this line with the other host extension tests.

- [x] **Step 2: Run failing tests**

Run:

```bash
cargo test -p plugin-framework host_extension_manifest
```

Expected:

```text
unresolved imports `plugin_framework::parse_host_extension_manifest`
```

- [x] **Step 3: Implement manifest parser**

Create `api/crates/plugin-framework/src/host_extension_manifest.rs`:

```rust
use serde::Deserialize;

use crate::{
    error::{FrameworkResult, PluginFrameworkError},
};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum HostExtensionSourceKind {
    Builtin,
    FilesystemDropin,
    Uploaded,
}

impl HostExtensionSourceKind {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Builtin => "builtin",
            Self::FilesystemDropin => "filesystem_dropin",
            Self::Uploaded => "uploaded",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum HostExtensionActivationPhase {
    Boot,
}

impl HostExtensionActivationPhase {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Boot => "boot",
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct HostExtensionInterfaceManifest {
    pub code: String,
    pub kind: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct HostExtensionStorageManifest {
    pub kind: String,
    pub implementation: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct HostExtensionDependencyManifest {
    pub extension_id: String,
    pub version_range: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Deserialize, Default)]
#[serde(deny_unknown_fields)]
pub struct HostExtensionLoadOrderManifest {
    #[serde(default)]
    pub after: Vec<String>,
    #[serde(default)]
    pub before: Vec<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct HostExtensionManifestV1 {
    pub manifest_version: u32,
    pub extension_id: String,
    pub version: String,
    pub display_name: String,
    pub source_kind: HostExtensionSourceKind,
    pub trust_level: String,
    pub activation_phase: HostExtensionActivationPhase,
    #[serde(default)]
    pub provides_contracts: Vec<String>,
    #[serde(default)]
    pub overrides_contracts: Vec<String>,
    #[serde(default)]
    pub registers_slots: Vec<String>,
    #[serde(default)]
    pub registers_interfaces: Vec<HostExtensionInterfaceManifest>,
    #[serde(default)]
    pub registers_storage: Vec<HostExtensionStorageManifest>,
    #[serde(default)]
    pub dependencies: Vec<HostExtensionDependencyManifest>,
    #[serde(default)]
    pub load_order: HostExtensionLoadOrderManifest,
}

pub fn parse_host_extension_manifest(raw: &str) -> FrameworkResult<HostExtensionManifestV1> {
    let manifest: HostExtensionManifestV1 = serde_yaml::from_str(raw)
        .map_err(|error| PluginFrameworkError::invalid_provider_package(error.to_string()))?;
    validate_host_extension_manifest(&manifest)?;
    Ok(manifest)
}

fn validate_host_extension_manifest(manifest: &HostExtensionManifestV1) -> FrameworkResult<()> {
    if manifest.manifest_version != 1 {
        return Err(PluginFrameworkError::invalid_provider_package(
            "manifest_version must be 1",
        ));
    }
    validate_required(&manifest.extension_id, "extension_id")?;
    validate_required(&manifest.version, "version")?;
    validate_required(&manifest.display_name, "display_name")?;
    validate_required(&manifest.trust_level, "trust_level")?;

    for contract in manifest
        .provides_contracts
        .iter()
        .chain(manifest.overrides_contracts.iter())
    {
        validate_required(contract, "contracts")?;
    }
    for slot in &manifest.registers_slots {
        validate_required(slot, "registers_slots")?;
    }
    for interface in &manifest.registers_interfaces {
        validate_required(&interface.code, "registers_interfaces.code")?;
        validate_required(&interface.kind, "registers_interfaces.kind")?;
    }
    for storage in &manifest.registers_storage {
        validate_required(&storage.kind, "registers_storage.kind")?;
        validate_required(&storage.implementation, "registers_storage.implementation")?;
    }

    Ok(())
}

fn validate_required(value: &str, field: &'static str) -> FrameworkResult<()> {
    if value.trim().is_empty() {
        return Err(PluginFrameworkError::invalid_provider_package(format!(
            "{field} must not be empty"
        )));
    }
    Ok(())
}
```

Modify `api/crates/plugin-framework/src/lib.rs`:

```rust
pub mod host_extension_manifest;

pub use host_extension_manifest::{
    parse_host_extension_manifest, HostExtensionActivationPhase, HostExtensionDependencyManifest,
    HostExtensionInterfaceManifest, HostExtensionLoadOrderManifest, HostExtensionManifestV1,
    HostExtensionSourceKind, HostExtensionStorageManifest,
};
```

- [x] **Step 4: Run tests**

Run:

```bash
cargo test -p plugin-framework host_extension_manifest
```

Expected:

```text
test result: ok
```

### Task 2: Add In-Memory HostExtension Registry

**Files:**
- Create: `api/crates/plugin-framework/src/host_extension_registry.rs`
- Modify: `api/crates/plugin-framework/src/lib.rs`
- Create: `api/crates/plugin-framework/src/_tests/host_extension_registry_tests.rs`
- Modify: `api/crates/plugin-framework/src/_tests/mod.rs`

- [x] **Step 1: Write failing registry tests**

Create `api/crates/plugin-framework/src/_tests/host_extension_registry_tests.rs`:

```rust
use plugin_framework::{HostExtensionRegistry, RegisteredHostExtension};

#[test]
fn registry_rejects_duplicate_contract_without_override() {
    let mut registry = HostExtensionRegistry::default();
    registry
        .register(RegisteredHostExtension {
            extension_id: "official.storage-host".into(),
            provides_contracts: vec!["storage-durable".into()],
            overrides_contracts: vec![],
            registers_slots: vec![],
            registers_storage: vec![("storage-durable".into(), "postgres".into())],
        })
        .expect("first registration should pass");

    let error = registry
        .register(RegisteredHostExtension {
            extension_id: "custom.storage-host".into(),
            provides_contracts: vec!["storage-durable".into()],
            overrides_contracts: vec![],
            registers_slots: vec![],
            registers_storage: vec![("storage-durable".into(), "cockroach".into())],
        })
        .expect_err("duplicate contract requires override");

    assert!(error.to_string().contains("storage-durable"));
}

#[test]
fn registry_allows_explicit_contract_override() {
    let mut registry = HostExtensionRegistry::default();
    registry
        .register(RegisteredHostExtension {
            extension_id: "official.storage-host".into(),
            provides_contracts: vec!["storage-ephemeral".into()],
            overrides_contracts: vec![],
            registers_slots: vec![],
            registers_storage: vec![("storage-ephemeral".into(), "memory".into())],
        })
        .expect("first registration should pass");

    registry
        .register(RegisteredHostExtension {
            extension_id: "custom.redis-host".into(),
            provides_contracts: vec![],
            overrides_contracts: vec!["storage-ephemeral".into()],
            registers_slots: vec![],
            registers_storage: vec![("storage-ephemeral".into(), "redis".into())],
        })
        .expect("explicit override should pass");

    assert_eq!(
        registry.contract_provider("storage-ephemeral"),
        Some("custom.redis-host")
    );
}
```

- [x] **Step 2: Run failing tests**

Run:

```bash
cargo test -p plugin-framework host_extension_registry
```

Expected:

```text
unresolved imports `plugin_framework::HostExtensionRegistry`
```

- [x] **Step 3: Implement registry**

Create `api/crates/plugin-framework/src/host_extension_registry.rs`:

```rust
use std::collections::{BTreeMap, BTreeSet};

use crate::{error::{FrameworkResult, PluginFrameworkError}};

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct RegisteredHostExtension {
    pub extension_id: String,
    pub provides_contracts: Vec<String>,
    pub overrides_contracts: Vec<String>,
    pub registers_slots: Vec<String>,
    pub registers_storage: Vec<(String, String)>,
}

#[derive(Debug, Default)]
pub struct HostExtensionRegistry {
    contracts: BTreeMap<String, String>,
    slots: BTreeMap<String, String>,
    storage: BTreeMap<String, String>,
    extensions: BTreeSet<String>,
}

impl HostExtensionRegistry {
    pub fn register(&mut self, extension: RegisteredHostExtension) -> FrameworkResult<()> {
        if !self.extensions.insert(extension.extension_id.clone()) {
            return Err(PluginFrameworkError::invalid_provider_package(format!(
                "duplicate host extension: {}",
                extension.extension_id
            )));
        }

        for contract in extension.provides_contracts {
            if self.contracts.contains_key(&contract) {
                return Err(PluginFrameworkError::invalid_provider_package(format!(
                    "host contract {contract} already registered"
                )));
            }
            self.contracts
                .insert(contract, extension.extension_id.clone());
        }

        for contract in extension.overrides_contracts {
            self.contracts
                .insert(contract, extension.extension_id.clone());
        }

        for slot in extension.registers_slots {
            self.slots.insert(slot, extension.extension_id.clone());
        }

        for (kind, implementation) in extension.registers_storage {
            self.storage.insert(kind, implementation);
        }

        Ok(())
    }

    pub fn contract_provider(&self, contract: &str) -> Option<&str> {
        self.contracts.get(contract).map(String::as_str)
    }

    pub fn slot_provider(&self, slot: &str) -> Option<&str> {
        self.slots.get(slot).map(String::as_str)
    }

    pub fn storage_implementation(&self, kind: &str) -> Option<&str> {
        self.storage.get(kind).map(String::as_str)
    }
}
```

Modify `api/crates/plugin-framework/src/lib.rs`:

```rust
pub mod host_extension_registry;

pub use host_extension_registry::{HostExtensionRegistry, RegisteredHostExtension};
```

- [x] **Step 4: Run tests**

Run:

```bash
cargo test -p plugin-framework host_extension_registry
```

Expected:

```text
test result: ok
```

### Task 3: Add Domain Inventory Types

**Files:**
- Create: `api/crates/domain/src/host_extension.rs`
- Modify: `api/crates/domain/src/lib.rs`
- Create: `api/crates/domain/src/_tests/host_extension_tests.rs`
- Modify: `api/crates/domain/src/_tests/mod.rs`

- [x] **Step 1: Write failing inventory tests**

Create `api/crates/domain/src/_tests/host_extension_tests.rs`:

```rust
use domain::{HostExtensionActivationStatus, HostExtensionTrustLevel};

#[test]
fn host_extension_inventory_enum_strings_are_stable() {
    assert_eq!(HostExtensionActivationStatus::Discovered.as_str(), "discovered");
    assert_eq!(HostExtensionActivationStatus::Active.as_str(), "active");
    assert_eq!(HostExtensionActivationStatus::Unhealthy.as_str(), "unhealthy");
    assert_eq!(HostExtensionTrustLevel::TrustedHost.as_str(), "trusted_host");
}
```

Modify `api/crates/domain/src/_tests/mod.rs`:

```rust
mod host_extension_tests;
```

- [x] **Step 2: Run failing test**

Run:

```bash
cargo test -p domain host_extension_inventory_enum_strings_are_stable
```

Expected:

```text
unresolved imports
```

- [x] **Step 3: Implement domain types**

Create `api/crates/domain/src/host_extension.rs`:

```rust
use serde::{Deserialize, Serialize};
use time::OffsetDateTime;
use uuid::Uuid;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum HostExtensionActivationStatus {
    Discovered,
    PolicyRejected,
    PendingRestart,
    Active,
    Unhealthy,
}

impl HostExtensionActivationStatus {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Discovered => "discovered",
            Self::PolicyRejected => "policy_rejected",
            Self::PendingRestart => "pending_restart",
            Self::Active => "active",
            Self::Unhealthy => "unhealthy",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum HostExtensionTrustLevel {
    TrustedHost,
    LocalTrusted,
    UnverifiedHost,
}

impl HostExtensionTrustLevel {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::TrustedHost => "trusted_host",
            Self::LocalTrusted => "local_trusted",
            Self::UnverifiedHost => "unverified_host",
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct HostExtensionInventoryRecord {
    pub id: Uuid,
    pub extension_id: String,
    pub version: String,
    pub display_name: String,
    pub source_kind: String,
    pub trust_level: HostExtensionTrustLevel,
    pub activation_status: HostExtensionActivationStatus,
    pub provides_contracts: Vec<String>,
    pub overrides_contracts: Vec<String>,
    pub registers_slots: Vec<String>,
    pub registers_storage: Vec<String>,
    pub last_error: Option<String>,
    pub created_at: OffsetDateTime,
    pub updated_at: OffsetDateTime,
}
```

Modify `api/crates/domain/src/lib.rs`:

```rust
pub mod host_extension;

pub use host_extension::{
    HostExtensionActivationStatus, HostExtensionInventoryRecord, HostExtensionTrustLevel,
};
```

- [x] **Step 4: Run tests**

Run:

```bash
cargo test -p domain host_extension_inventory_enum_strings_are_stable
```

Expected:

```text
test result: ok
```

### Task 4: Add Control-Plane Inventory Port and Service

**Files:**
- Modify: `api/crates/control-plane/src/ports/plugin.rs`
- Create: `api/crates/control-plane/src/host_extension_inventory.rs`
- Modify: `api/crates/control-plane/src/lib.rs`

- [x] **Step 1: Add repository port**

Append to `api/crates/control-plane/src/ports/plugin.rs`:

```rust
#[derive(Debug, Clone)]
pub struct UpsertHostExtensionInventoryInput {
    pub extension_id: String,
    pub version: String,
    pub display_name: String,
    pub source_kind: String,
    pub trust_level: domain::HostExtensionTrustLevel,
    pub activation_status: domain::HostExtensionActivationStatus,
    pub provides_contracts: Vec<String>,
    pub overrides_contracts: Vec<String>,
    pub registers_slots: Vec<String>,
    pub registers_storage: Vec<String>,
    pub last_error: Option<String>,
}

#[async_trait]
pub trait HostExtensionInventoryRepository: Send + Sync {
    async fn upsert_host_extension_inventory(
        &self,
        input: &UpsertHostExtensionInventoryInput,
    ) -> anyhow::Result<domain::HostExtensionInventoryRecord>;

    async fn list_host_extension_inventory(
        &self,
    ) -> anyhow::Result<Vec<domain::HostExtensionInventoryRecord>>;
}
```

- [x] **Step 2: Add read service**

Create `api/crates/control-plane/src/host_extension_inventory.rs`:

```rust
use anyhow::Result;

use crate::ports::HostExtensionInventoryRepository;

pub struct HostExtensionInventoryService<R> {
    repository: R,
}

impl<R> HostExtensionInventoryService<R>
where
    R: HostExtensionInventoryRepository,
{
    pub fn new(repository: R) -> Self {
        Self { repository }
    }

    pub async fn list_inventory(&self) -> Result<Vec<domain::HostExtensionInventoryRecord>> {
        let mut records = self.repository.list_host_extension_inventory().await?;
        records.sort_by(|left, right| left.extension_id.cmp(&right.extension_id));
        Ok(records)
    }
}
```

Modify `api/crates/control-plane/src/lib.rs`:

```rust
pub mod host_extension_inventory;
```

- [x] **Step 3: Run compile check**

Run:

```bash
cargo test -p control-plane host_extension_inventory --lib
```

Expected:

```text
test result: ok
```

### Task 5: Commit

**Files:**
- All files listed in this plan

- [x] **Step 1: Run focused tests**

Run:

```bash
cargo test -p plugin-framework host_extension_manifest host_extension_registry
cargo test -p domain host_extension
cargo test -p control-plane host_extension_inventory --lib
```

Expected:

```text
test result: ok
```

- [x] **Step 2: Commit**

Run:

```bash
git add api/crates/plugin-framework/src api/crates/domain/src api/crates/control-plane/src
git commit -m "feat: add host extension manifest registry"
```

Expected:

```text
[project-maintenance <sha>] feat: add host extension manifest registry
```
