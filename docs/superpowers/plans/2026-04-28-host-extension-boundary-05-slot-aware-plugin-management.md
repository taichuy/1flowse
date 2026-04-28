# Slot-Aware Plugin Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把现有 provider-centric 插件安装、启用、分配链路改造成 host-extension-aware 与 runtime-slot-aware。

**Architecture:** 保留现有 provider 行为兼容，但把非 host 插件解析入口改成按 manifest `consumption_kind + slot_codes + contract_version` 分派。HostExtension 进入 boot lifecycle，不走普通 enable/assign；RuntimeExtension 根据 slot 创建对应 package view；CapabilityPlugin 同步 node contribution。

**Tech Stack:** Rust 2021、SQLx/PostgreSQL、Serde YAML、Axum route tests、cargo test

---

## File Structure

- Modify: `api/crates/control-plane/src/plugin_management/install.rs`
- Modify: `api/crates/control-plane/src/plugin_management/family.rs`
- Create: `api/crates/control-plane/src/plugin_management/package_router.rs`
- Modify: `api/crates/control-plane/src/plugin_management/mod.rs`
- Create: `api/crates/control-plane/src/_tests/plugin_management/package_router.rs`
- Modify: `api/crates/control-plane/src/_tests/plugin_management/mod.rs`
- Modify: `api/crates/control-plane/src/_tests/plugin_management/install.rs`
- Modify: `api/crates/control-plane/src/_tests/plugin_management/family.rs`
- Modify: `api/apps/api-server/src/routes/plugins_and_models/plugins.rs`
- Modify: `api/apps/api-server/src/_tests/plugin_routes/install_and_access.rs`

### Task 1: Add Package Router

**Files:**
- Create: `api/crates/control-plane/src/plugin_management/package_router.rs`
- Modify: `api/crates/control-plane/src/plugin_management/mod.rs`
- Create: `api/crates/control-plane/src/_tests/plugin_management/package_router.rs`
- Modify: `api/crates/control-plane/src/_tests/plugin_management/mod.rs`

- [x] **Step 1: Write failing package router tests**

Create `api/crates/control-plane/src/_tests/plugin_management/package_router.rs`:

```rust
use control_plane::plugin_management::{route_plugin_package, RoutedPluginPackageKind};
use plugin_framework::parse_plugin_manifest;

fn manifest_with_slot(slot: &str, contract_version: &str) -> String {
    format!(
        r#"
manifest_version: 1
plugin_id: fixture@0.1.0
version: 0.1.0
vendor: acme
display_name: Fixture
description: Fixture runtime extension
source_kind: official_registry
trust_level: verified_official
consumption_kind: runtime_extension
execution_mode: process_per_call
slot_codes:
  - {slot}
binding_targets:
  - workspace
selection_mode: assignment_then_select
minimum_host_version: 0.1.0
contract_version: {contract_version}
schema_version: 1flowbase.plugin.manifest/v1
permissions:
  network: outbound
  secrets: provider_instance_only
  storage: none
  mcp: none
  subprocess: denied
runtime:
  protocol: stdio_json
  entry: bin/fixture
"#
    )
}

#[test]
fn router_detects_model_provider_runtime_extension() {
    let raw = manifest_with_slot("model_provider", "1flowbase.provider/v1");
    let manifest = parse_plugin_manifest(&raw).expect("manifest should parse");
    assert_eq!(
        route_plugin_package(&manifest).expect("should route"),
        RoutedPluginPackageKind::ModelProviderRuntime
    );
}

#[test]
fn router_detects_data_source_runtime_extension() {
    let raw = manifest_with_slot("data_source", "1flowbase.data_source/v1");
    let manifest = parse_plugin_manifest(&raw).expect("manifest should parse");
    assert_eq!(
        route_plugin_package(&manifest).expect("should route"),
        RoutedPluginPackageKind::DataSourceRuntime
    );
}
```

Modify `api/crates/control-plane/src/_tests/plugin_management/mod.rs`:

```rust
mod package_router;
```

- [x] **Step 2: Run failing tests**

Run:

```bash
cargo test -p control-plane router_detects_model_provider_runtime_extension router_detects_data_source_runtime_extension
```

Expected:

```text
unresolved import `route_plugin_package`
```

- [x] **Step 3: Implement router**

Create `api/crates/control-plane/src/plugin_management/package_router.rs`:

```rust
use plugin_framework::{PluginConsumptionKind, PluginManifestV1};

use crate::errors::ControlPlaneError;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum RoutedPluginPackageKind {
    HostExtension,
    ModelProviderRuntime,
    DataSourceRuntime,
    CapabilityPlugin,
}

pub fn route_plugin_package(
    manifest: &PluginManifestV1,
) -> anyhow::Result<RoutedPluginPackageKind> {
    match manifest.consumption_kind {
        PluginConsumptionKind::HostExtension => Ok(RoutedPluginPackageKind::HostExtension),
        PluginConsumptionKind::CapabilityPlugin => Ok(RoutedPluginPackageKind::CapabilityPlugin),
        PluginConsumptionKind::RuntimeExtension => {
            if manifest.slot_codes.iter().any(|slot| slot == "model_provider") {
                return Ok(RoutedPluginPackageKind::ModelProviderRuntime);
            }
            if manifest.slot_codes.iter().any(|slot| slot == "data_source") {
                return Ok(RoutedPluginPackageKind::DataSourceRuntime);
            }
            Err(ControlPlaneError::InvalidInput("runtime_slot").into())
        }
    }
}
```

Modify `api/crates/control-plane/src/plugin_management/mod.rs`:

```rust
mod package_router;

pub use package_router::{route_plugin_package, RoutedPluginPackageKind};
```

- [x] **Step 4: Run tests**

Run:

```bash
cargo test -p control-plane package_router
```

Expected:

```text
test result: ok
```

### Task 2: Refactor Install Dispatch

**Files:**
- Modify: `api/crates/control-plane/src/plugin_management/install.rs`
- Modify: `api/crates/control-plane/src/_tests/plugin_management/install.rs`

- [x] **Step 1: Add failing data-source install test**

Append to `api/crates/control-plane/src/_tests/plugin_management/install.rs`:

```rust
#[tokio::test]
async fn plugin_management_service_does_not_route_data_source_package_as_model_provider() {
    let workspace_id = Uuid::now_v7();
    let repository = MemoryPluginManagementRepository::new(actor_with_permissions(
        workspace_id,
        &["plugin_config.view.all", "plugin_config.configure.all"],
    ));
    let runtime = MemoryProviderRuntime::default();
    let service = PluginManagementService::new(
        repository.clone(),
        runtime,
        Arc::new(MemoryOfficialPluginSource::default()),
        std::env::temp_dir().join(format!("plugin-data-source-installed-{}", Uuid::now_v7())),
    );
    let package_root = create_data_source_fixture_package("http_source", "0.1.0");

    let result = service
        .install_plugin(InstallPluginCommand {
            actor_user_id: repository.actor.user_id,
            package_root: package_root.display().to_string(),
        })
        .await
        .expect("data source package should install");

    assert_eq!(result.installation.contract_version, "1flowbase.data_source/v1");
    assert_eq!(result.installation.provider_code, "http_source");
}
```

Add this helper beside existing provider fixture helpers:

```rust
fn create_data_source_fixture_package(source_code: &str, version: &str) -> tempfile::TempDir {
    let dir = tempfile::tempdir().expect("tempdir");
    std::fs::write(
        dir.path().join("manifest.yaml"),
        format!(r#"
manifest_version: 1
plugin_id: {source_code}@{version}
version: {version}
vendor: acme
display_name: HTTP Source
description: HTTP source runtime extension
source_kind: uploaded
trust_level: checksum_only
consumption_kind: runtime_extension
execution_mode: process_per_call
slot_codes: [data_source]
binding_targets: [workspace]
selection_mode: assignment_then_select
minimum_host_version: 0.1.0
contract_version: 1flowbase.data_source/v1
schema_version: 1flowbase.plugin.manifest/v1
permissions:
  network: outbound
  secrets: provider_instance_only
  storage: none
  mcp: none
  subprocess: denied
runtime:
  protocol: stdio_json
  entry: bin/{source_code}
"#),
    ).unwrap();
    std::fs::create_dir_all(dir.path().join("bin")).unwrap();
    std::fs::write(dir.path().join("bin").join(source_code), "#!/bin/sh\n").unwrap();
    std::fs::create_dir_all(dir.path().join("datasource")).unwrap();
    std::fs::write(
        dir.path().join("datasource").join(format!("{source_code}.yaml")),
        format!(r#"
source_code: {source_code}
display_name: HTTP Source
auth_modes: [api_key]
capabilities: [preview_read]
supports_sync: false
supports_webhook: false
resource_kinds: [table]
config_schema: []
"#),
    ).unwrap();
    dir
}
```

- [x] **Step 2: Run failing test**

Run:

```bash
cargo test -p control-plane plugin_management_service_does_not_route_data_source_package_as_model_provider
```

Expected:

```text
FAIL with provider package validation error
```

- [x] **Step 3: Dispatch by routed package kind**

Modify `install_plugin_with_metadata` in `api/crates/control-plane/src/plugin_management/install.rs`:

1. After loading the manifest, call:

```rust
let package_kind = route_plugin_package(&manifest)?;
```

2. Replace the current `if is_host_extension_manifest(&manifest) { ... } else { load_provider_package ... }` shape with:

```rust
match package_kind {
    RoutedPluginPackageKind::HostExtension => {
        // move the existing host extension branch here unchanged
    }
    RoutedPluginPackageKind::ModelProviderRuntime => {
        // move the existing ProviderPackage branch here unchanged
    }
    RoutedPluginPackageKind::DataSourceRuntime => {
        let installed_package = plugin_framework::data_source_package::DataSourcePackage::load_from_dir(&install_path)
            .map_err(map_framework_error)?;
        let metadata_json = json!({
            "supported_resource_kinds": installed_package.definition.resource_kinds,
            "auth_modes": installed_package.definition.auth_modes,
            "capabilities": installed_package.definition.capabilities,
            "install_kind": detail_json.get("install_kind").cloned().unwrap_or(json!("unknown")),
        });
        self.repository
            .upsert_installation(&UpsertPluginInstallationInput {
                installation_id: Uuid::now_v7(),
                provider_code: installed_package.definition.source_code.clone(),
                plugin_id: installed_package.identifier(),
                plugin_version: installed_package.manifest.version.clone(),
                contract_version: installed_package.manifest.contract_version.clone(),
                protocol: "data_source".to_string(),
                display_name: installed_package.definition.display_name.clone(),
                source_kind: source_metadata.source_kind.clone(),
                trust_level: source_metadata.trust_level.clone(),
                verification_status: domain::PluginVerificationStatus::Valid,
                desired_state: domain::PluginDesiredState::Disabled,
                artifact_status: domain::PluginArtifactStatus::Ready,
                runtime_status: domain::PluginRuntimeStatus::Inactive,
                availability_status: derive_availability_status(
                    domain::PluginDesiredState::Disabled,
                    domain::PluginArtifactStatus::Ready,
                    domain::PluginRuntimeStatus::Inactive,
                ),
                package_path: source_metadata.package_bytes.as_ref().map(|_| {
                    package_archive_path.display().to_string()
                }),
                installed_path: install_path.display().to_string(),
                checksum: source_metadata.checksum.clone(),
                manifest_fingerprint: Some(manifest_fingerprint),
                signature_status: source_metadata.signature_status.clone(),
                signature_algorithm: source_metadata.signature_algorithm.clone(),
                signing_key_id: source_metadata.signing_key_id.clone(),
                last_load_error: None,
                metadata_json,
                actor_user_id: command.actor_user_id,
            })
            .await
    }
    RoutedPluginPackageKind::CapabilityPlugin => {
        return Err(ControlPlaneError::InvalidInput("capability_plugin_install_not_supported_yet").into());
    }
}
```

Adjust the code to preserve existing audit/task behavior. Do not duplicate task transition code.

- [x] **Step 4: Run test**

Run:

```bash
cargo test -p control-plane plugin_management_service_does_not_route_data_source_package_as_model_provider
```

Expected:

```text
test result: ok
```

### Task 3: Restrict Enable and Assign by Routed Kind

**Files:**
- Modify: `api/crates/control-plane/src/plugin_management/family.rs`
- Modify: `api/crates/control-plane/src/_tests/plugin_management/family.rs`

- [x] **Step 1: Add failing assignment test**

Append to `api/crates/control-plane/src/_tests/plugin_management/family.rs`:

```rust
#[tokio::test]
async fn assign_plugin_allows_data_source_runtime_installation() {
    let (service, repository, actor_user_id, installation_id, workspace_id) =
        seed_data_source_runtime_installation().await;

    service
        .enable_plugin(EnablePluginCommand {
            actor_user_id,
            installation_id,
        })
        .await
        .expect("data source runtime should enable");

    service
        .assign_plugin(AssignPluginCommand {
            actor_user_id,
            installation_id,
        })
        .await
        .expect("data source runtime should assign");

    let assignments = repository.list_assignments(workspace_id).await.unwrap();
    assert!(assignments.iter().any(|item| item.installation_id == installation_id));
}
```

Use the existing in-memory repository fixture shape from `family.rs`. Seed the installation with:

```rust
contract_version: "1flowbase.data_source/v1"
provider_code: "http_source"
desired_state: PluginDesiredState::Disabled
artifact_status: PluginArtifactStatus::Ready
runtime_status: PluginRuntimeStatus::Inactive
```

- [x] **Step 2: Run failing test**

Run:

```bash
cargo test -p control-plane assign_plugin_allows_data_source_runtime_installation
```

Expected:

```text
FAIL with plugin_assignment_not_supported
```

- [x] **Step 3: Replace model-provider-only assignment guard**

In `api/crates/control-plane/src/plugin_management/family.rs`, replace:

```rust
if !is_model_provider_installation(&installation) {
    return Err(ControlPlaneError::Conflict("plugin_assignment_not_supported").into());
}
```

with:

```rust
if !supports_workspace_assignment(&installation) {
    return Err(ControlPlaneError::Conflict("plugin_assignment_not_supported").into());
}
```

Add helper near existing installation helpers:

```rust
fn supports_workspace_assignment(installation: &domain::PluginInstallationRecord) -> bool {
    matches!(
        installation.contract_version.as_str(),
        "1flowbase.provider/v1" | "1flowbase.data_source/v1"
    )
}
```

- [x] **Step 4: Run test**

Run:

```bash
cargo test -p control-plane assign_plugin_allows_data_source_runtime_installation
```

Expected:

```text
test result: ok
```

### Task 4: Route Layer Names Remain Backward Compatible

**Files:**
- Modify: `api/apps/api-server/src/routes/plugins_and_models/plugins.rs`
- Modify: `api/apps/api-server/src/_tests/plugin_routes/install_and_access.rs`

- [x] **Step 1: Add response contract test**

Append to `api/apps/api-server/src/_tests/plugin_routes/install_and_access.rs`:

```rust
#[tokio::test]
async fn plugin_routes_expose_slot_kind_without_breaking_provider_code() {
    let app = test_app().await;
    let (cookie, csrf) = login_and_capture_cookie(&app, "root", "change-me").await;
    let package_root = std::env::temp_dir().join(format!("plugin-route-slot-{}", uuid::Uuid::now_v7()));
    create_fixture_provider_package(&package_root, "0.1.0");

    let install = app
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/api/console/plugins/install")
                .header("cookie", &cookie)
                .header("x-csrf-token", &csrf)
                .header("content-type", "application/json")
                .body(Body::from(
                    json!({ "package_root": package_root.display().to_string() }).to_string(),
                ))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(install.status(), StatusCode::CREATED);
    let payload: serde_json::Value =
        serde_json::from_slice(&to_bytes(install.into_body(), usize::MAX).await.unwrap()).unwrap();

    let installation = &payload["data"]["installation"];
    assert_eq!(installation["provider_code"], "openai_compatible");
    assert_eq!(installation["runtime_slot"], "model_provider");
}
```

Use the existing route test helper names in this module. If the route path differs, use the existing list installation test path.

- [x] **Step 2: Run failing test**

Run:

```bash
cargo test -p api-server plugin_routes_expose_slot_kind_without_breaking_provider_code
```

Expected:

```text
FAIL because runtime_slot is missing
```

- [x] **Step 3: Add runtime_slot to route DTO**

In `api/apps/api-server/src/routes/plugins_and_models/plugins.rs`, add to installation response DTO:

```rust
pub runtime_slot: Option<String>,
```

Map it with:

```rust
runtime_slot: runtime_slot_for_contract(&record.contract_version),
```

Add helper:

```rust
fn runtime_slot_for_contract(contract_version: &str) -> Option<String> {
    match contract_version {
        "1flowbase.provider/v1" => Some("model_provider".to_string()),
        "1flowbase.data_source/v1" => Some("data_source".to_string()),
        _ => None,
    }
}
```

- [x] **Step 4: Run test**

Run:

```bash
cargo test -p api-server plugin_routes_expose_slot_kind_without_breaking_provider_code
```

Expected:

```text
test result: ok
```

### Task 5: Commit

**Files:**
- All files listed in this plan

- [x] **Step 1: Run focused regression**

Run:

```bash
cargo test -p control-plane package_router plugin_management_service_does_not_route_data_source_package_as_model_provider assign_plugin_allows_data_source_runtime_installation
cargo test -p api-server plugin_routes_expose_slot_kind_without_breaking_provider_code
```

Expected:

```text
test result: ok
```

- [x] **Step 2: Commit**

Run:

```bash
git add api/crates/control-plane/src api/apps/api-server/src
git commit -m "feat: make plugin management slot aware"
```

Expected:

```text
[project-maintenance <sha>] feat: make plugin management slot aware
```
