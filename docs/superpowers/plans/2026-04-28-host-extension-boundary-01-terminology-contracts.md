# HostExtension Terminology and Contract Baseline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 固定 HostExtension 边界的工程术语、文档规则和基础类型，阻止 provider-centric 语义继续扩散。

**Architecture:** 先用测试锁定 `Boot Core / HostExtension / RuntimeExtension / CapabilityPlugin`、host contract、runtime slot、storage implementation 的字符串契约，再补文档和 AGENTS 硬规则。此阶段不改变运行时行为，只建立稳定语言和最小类型。

**Tech Stack:** Rust 2021、Serde、Markdown、cargo test

---

## File Structure

- Modify: `api/AGENTS.md`
- Modify: `api/crates/plugin-framework/src/capability_kind.rs`
- Modify: `api/crates/plugin-framework/src/manifest_v1.rs`
- Create: `api/crates/plugin-framework/src/host_contract.rs`
- Modify: `api/crates/plugin-framework/src/lib.rs`
- Create: `api/crates/plugin-framework/src/_tests/host_contract_tests.rs`
- Modify: `api/crates/plugin-framework/src/_tests/mod.rs`
- Modify: `docs/superpowers/specs/1flowbase/2026-04-20-plugin-architecture-and-node-contribution-design.md`
- Modify: `docs/superpowers/specs/2026-04-28-host-extension-boundary-design.md`

### Task 1: Add Host Contract and Runtime Slot Constants

**Files:**
- Create: `api/crates/plugin-framework/src/host_contract.rs`
- Modify: `api/crates/plugin-framework/src/lib.rs`
- Create: `api/crates/plugin-framework/src/_tests/host_contract_tests.rs`
- Modify: `api/crates/plugin-framework/src/_tests/mod.rs`

- [x] **Step 1: Write failing tests**

Create `api/crates/plugin-framework/src/_tests/host_contract_tests.rs`:

```rust
use plugin_framework::{
    HostContractCode, RuntimeSlotCode, StorageImplementationKind,
};

#[test]
fn host_contract_codes_are_stable() {
    assert_eq!(HostContractCode::StorageDurable.as_str(), "storage-durable");
    assert_eq!(HostContractCode::StorageEphemeral.as_str(), "storage-ephemeral");
    assert_eq!(HostContractCode::StorageObject.as_str(), "storage-object");
    assert_eq!(HostContractCode::FileManagement.as_str(), "file_management");
    assert_eq!(HostContractCode::DataAccess.as_str(), "data_access");
}

#[test]
fn runtime_slot_codes_are_stable() {
    assert_eq!(RuntimeSlotCode::ModelProvider.as_str(), "model_provider");
    assert_eq!(RuntimeSlotCode::DataSource.as_str(), "data_source");
    assert_eq!(RuntimeSlotCode::FileProcessor.as_str(), "file_processor");
}

#[test]
fn storage_implementation_kinds_are_not_named_driver() {
    assert_eq!(StorageImplementationKind::Durable.as_str(), "storage-durable");
    assert_eq!(StorageImplementationKind::Ephemeral.as_str(), "storage-ephemeral");
    assert_eq!(StorageImplementationKind::Object.as_str(), "storage-object");
}
```

Modify `api/crates/plugin-framework/src/_tests/mod.rs`:

```rust
mod artifact_reconcile_tests;
mod assignment_tests;
mod data_source_contract_tests;
mod data_source_package_tests;
mod host_contract_tests;
mod host_extension_dropin_tests;
mod manifest_v1_tests;
mod package_intake_tests;
mod provider_contract_tests;
mod provider_manifest_adapter_tests;
mod provider_package_tests;
mod runtime_target_tests;
```

- [x] **Step 2: Run failing test**

Run:

```bash
cargo test -p plugin-framework host_contract_codes_are_stable
```

Expected:

```text
unresolved imports `plugin_framework::HostContractCode`
```

- [x] **Step 3: Add contract types**

Create `api/crates/plugin-framework/src/host_contract.rs`:

```rust
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum HostContractCode {
    Identity,
    Workspace,
    PluginManagement,
    RuntimeOrchestration,
    StorageDurable,
    StorageEphemeral,
    StorageObject,
    FileManagement,
    DataAccess,
    ModelRuntime,
    Observability,
}

impl HostContractCode {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Identity => "identity",
            Self::Workspace => "workspace",
            Self::PluginManagement => "plugin_management",
            Self::RuntimeOrchestration => "runtime_orchestration",
            Self::StorageDurable => "storage-durable",
            Self::StorageEphemeral => "storage-ephemeral",
            Self::StorageObject => "storage-object",
            Self::FileManagement => "file_management",
            Self::DataAccess => "data_access",
            Self::ModelRuntime => "model_runtime",
            Self::Observability => "observability",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum RuntimeSlotCode {
    ModelProvider,
    EmbeddingProvider,
    RerankerProvider,
    DataSource,
    FileProcessor,
    RecordValidator,
    FieldComputedValue,
}

impl RuntimeSlotCode {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::ModelProvider => "model_provider",
            Self::EmbeddingProvider => "embedding_provider",
            Self::RerankerProvider => "reranker_provider",
            Self::DataSource => "data_source",
            Self::FileProcessor => "file_processor",
            Self::RecordValidator => "record_validator",
            Self::FieldComputedValue => "field_computed_value",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum StorageImplementationKind {
    Durable,
    Ephemeral,
    Object,
}

impl StorageImplementationKind {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Durable => "storage-durable",
            Self::Ephemeral => "storage-ephemeral",
            Self::Object => "storage-object",
        }
    }
}
```

Modify `api/crates/plugin-framework/src/lib.rs`:

```rust
pub mod host_contract;

pub use host_contract::{HostContractCode, RuntimeSlotCode, StorageImplementationKind};
```

Keep existing exports in `lib.rs`; add these lines without removing current public API.

- [x] **Step 4: Run test**

Run:

```bash
cargo test -p plugin-framework host_contract
```

Expected:

```text
test result: ok
```

### Task 2: Tighten Manifest Semantics Around Runtime Slots

**Files:**
- Modify: `api/crates/plugin-framework/src/manifest_v1.rs`
- Modify: `api/crates/plugin-framework/src/_tests/manifest_v1_tests.rs`

- [x] **Step 1: Add failing tests for slot vocabulary**

Append to `api/crates/plugin-framework/src/_tests/manifest_v1_tests.rs`:

```rust
use plugin_framework::{parse_plugin_manifest, PluginConsumptionKind};

#[test]
fn runtime_extension_uses_registered_slot_vocabulary() {
    let raw = r#"
manifest_version: 1
plugin_id: openai_compatible@0.1.0
version: 0.1.0
vendor: acme
display_name: OpenAI Compatible
description: OpenAI-compatible runtime extension
source_kind: official_registry
trust_level: verified_official
consumption_kind: runtime_extension
execution_mode: process_per_call
slot_codes:
  - model_provider
binding_targets:
  - workspace
selection_mode: assignment_then_select
minimum_host_version: 0.1.0
contract_version: 1flowbase.provider/v1
schema_version: 1flowbase.plugin.manifest/v1
permissions:
  network: outbound
  secrets: provider_instance_only
  storage: none
  mcp: none
  subprocess: denied
runtime:
  protocol: stdio_json
  entry: bin/openai-compatible-provider
"#;

    let manifest = parse_plugin_manifest(raw).expect("manifest should parse");
    assert_eq!(manifest.consumption_kind, PluginConsumptionKind::RuntimeExtension);
    assert_eq!(manifest.slot_codes, vec!["model_provider"]);
}

#[test]
fn runtime_extension_rejects_provider_as_plugin_type_slot() {
    let raw = r#"
manifest_version: 1
plugin_id: legacy_provider@0.1.0
version: 0.1.0
vendor: acme
display_name: Legacy Provider
description: Legacy provider vocabulary
source_kind: official_registry
trust_level: verified_official
consumption_kind: runtime_extension
execution_mode: process_per_call
slot_codes:
  - provider
binding_targets:
  - workspace
selection_mode: assignment_then_select
minimum_host_version: 0.1.0
contract_version: 1flowbase.provider/v1
schema_version: 1flowbase.plugin.manifest/v1
permissions:
  network: outbound
  secrets: provider_instance_only
  storage: none
  mcp: none
  subprocess: denied
runtime:
  protocol: stdio_json
  entry: bin/legacy-provider
"#;

    let error = parse_plugin_manifest(raw).expect_err("provider is not a runtime slot");
    assert!(error.to_string().contains("slot_codes"));
}
```

- [x] **Step 2: Run failing test**

Run:

```bash
cargo test -p plugin-framework runtime_extension_rejects_provider_as_plugin_type_slot
```

Expected:

```text
FAIL
```

- [x] **Step 3: Add slot validation**

Modify `validate_plugin_manifest` in `api/crates/plugin-framework/src/manifest_v1.rs` after `validate_binding_targets(&manifest.binding_targets)?;`:

```rust
validate_slot_codes(&manifest.slot_codes)?;
```

Add this helper near existing validation helpers:

```rust
fn validate_slot_codes(slot_codes: &[String]) -> FrameworkResult<()> {
    const ALLOWED: &[&str] = &[
        "model_provider",
        "embedding_provider",
        "reranker_provider",
        "data_source",
        "file_processor",
        "record_validator",
        "field_computed_value",
    ];

    for slot in slot_codes {
        validate_allowed(slot, "slot_codes", ALLOWED)?;
    }

    Ok(())
}
```

- [x] **Step 4: Run tests**

Run:

```bash
cargo test -p plugin-framework runtime_extension_uses_registered_slot_vocabulary runtime_extension_rejects_provider_as_plugin_type_slot
```

Expected:

```text
test result: ok
```

### Task 3: Update Backend Rules and Legacy Plugin Spec

**Files:**
- Modify: `api/AGENTS.md`
- Modify: `docs/superpowers/specs/1flowbase/2026-04-20-plugin-architecture-and-node-contribution-design.md`

- [x] **Step 1: Update `api/AGENTS.md` plugin rules**

In `api/AGENTS.md`, replace the current plugin boundary bullets with this block:

```markdown
- `Boot Core` 只负责启动、加载、deployment policy、root/system bootstrap、extension inventory、health/reconcile，不承载完整业务能力面。
- `HostExtension` 是 system/root 级可信 host 模块，可定义、替换、增强 host contract；只能 boot-time 激活，不给 workspace 用户安装或热卸载。
- `RuntimeExtension` 只能实现已注册 runtime slot，例如 `model_provider`、`data_source`、`file_processor`；禁止注册 HTTP 接口、resource、auth provider 或直接写平台主存储。
- `CapabilityPlugin` 只能贡献 workspace 用户显式选择的能力，例如 canvas node、tool、trigger、publisher；禁止注册系统接口。
- `provider`、`data source`、`file processor` 不是插件主类型，分别是 runtime slot 或 host capability。
- `storage-durable`、`storage-ephemeral`、`storage-object` 是 host contract / implementation kind，不改名为 cache，不新增 `Driver` 层级。
```

- [x] **Step 2: Update 2026-04-20 spec status note**

At the top of `docs/superpowers/specs/1flowbase/2026-04-20-plugin-architecture-and-node-contribution-design.md`, after the header metadata, add:

```markdown
> 2026-04-28 更新：`HostExtension` 边界已上调为内核级 host 模块。后续以 [HostExtension 内核级插件边界设计](../2026-04-28-host-extension-boundary-design.md) 为准；本文中 `provider` 相关内容应理解为 `model_provider` runtime slot，而不是插件主类型。
```

- [x] **Step 3: Verify text**

Run:

```bash
rg -n "Boot Core|HostExtension|model_provider|storage-ephemeral|Driver" api/AGENTS.md docs/superpowers/specs/1flowbase/2026-04-20-plugin-architecture-and-node-contribution-design.md
```

Expected:

```text
api/AGENTS.md
docs/superpowers/specs/1flowbase/2026-04-20-plugin-architecture-and-node-contribution-design.md
```

### Task 4: Commit

**Files:**
- `api/AGENTS.md`
- `api/crates/plugin-framework/src/host_contract.rs`
- `api/crates/plugin-framework/src/lib.rs`
- `api/crates/plugin-framework/src/manifest_v1.rs`
- `api/crates/plugin-framework/src/_tests/host_contract_tests.rs`
- `api/crates/plugin-framework/src/_tests/manifest_v1_tests.rs`
- `api/crates/plugin-framework/src/_tests/mod.rs`
- `docs/superpowers/specs/1flowbase/2026-04-20-plugin-architecture-and-node-contribution-design.md`

- [x] **Step 1: Run final verification**

Run:

```bash
cargo test -p plugin-framework host_contract runtime_extension_rejects_provider_as_plugin_type_slot
```

Expected:

```text
test result: ok
```

- [x] **Step 2: Commit**

Run:

```bash
git add api/AGENTS.md api/crates/plugin-framework/src docs/superpowers/specs/1flowbase/2026-04-20-plugin-architecture-and-node-contribution-design.md
git commit -m "docs: lock host extension terminology"
```

Expected:

```text
[project-maintenance <sha>] docs: lock host extension terminology
```
