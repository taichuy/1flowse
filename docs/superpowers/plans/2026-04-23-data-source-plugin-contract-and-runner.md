# Data Source Plugin Contract And Runner Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a dedicated `1flowbase.data_source/v1` runtime-extension contract, package loader, and plugin-runner host so external database, SaaS, and API connectors can plug in without being forced through the model-provider contract.

**Architecture:** Keep this parallel to the existing model-provider and capability-plugin paths. `plugin-framework` owns the new data-source contract types and package loader; `plugin-runner` owns the process-per-call host and runtime routes. Nothing in this plan creates persistent platform state yet.

**Tech Stack:** Rust workspace crates, `serde`, `serde_json`, `tokio`, targeted `cargo test`.

**Source Discussion:** This plan implements the plugin-side contract root described in the approved data-source platform spec.

---

## File Structure

**Create**
- `api/crates/plugin-framework/src/data_source_contract.rs`
- `api/crates/plugin-framework/src/data_source_package.rs`
- `api/crates/plugin-framework/src/_tests/data_source_contract_tests.rs`
- `api/crates/plugin-framework/src/_tests/data_source_package_tests.rs`
- `api/apps/plugin-runner/src/data_source_host.rs`
- `api/apps/plugin-runner/tests/data_source_runtime_routes.rs`

**Modify**
- `api/crates/plugin-framework/src/lib.rs`
- `api/crates/plugin-framework/src/_tests/mod.rs`
- `api/apps/plugin-runner/src/lib.rs`

**Notes**
- Do not mutate `provider_contract.rs` into a generic “everything” protocol. Data-source runtime gets its own contract file.
- The new plugin path still uses `runtime_extension + process_per_call + stdio_json`.

### Task 1: Add RED Tests For The Data-Source Package Contract

**Files:**
- Create: `api/crates/plugin-framework/src/_tests/data_source_contract_tests.rs`
- Create: `api/crates/plugin-framework/src/_tests/data_source_package_tests.rs`
- Modify: `api/crates/plugin-framework/src/_tests/mod.rs`

- [x] **Step 1: Write failing fixture tests for the new package shape**

Create `api/crates/plugin-framework/src/_tests/data_source_package_tests.rs` with a temp-package fixture similar to the provider-package tests:

```rust
#[test]
fn loads_data_source_package_with_runtime_extension_contract() {
    let fixture = TempDataSourcePackage::new();
    fixture.write(
        "manifest.yaml",
        r#"manifest_version: 1
plugin_id: acme_hubspot_source@0.1.0
version: 0.1.0
vendor: acme
display_name: Acme HubSpot Source
description: test data source package
source_kind: uploaded
trust_level: unverified
consumption_kind: runtime_extension
execution_mode: process_per_call
slot_codes:
  - data_source
binding_targets:
  - workspace
selection_mode: assignment_then_select
minimum_host_version: 0.1.0
contract_version: 1flowbase.data_source/v1
schema_version: 1flowbase.plugin.manifest/v1
permissions:
  network: outbound_only
  secrets: provider_instance_only
  storage: none
  mcp: none
  subprocess: deny
runtime:
  protocol: stdio_json
  entry: bin/acme_hubspot_source
node_contributions: []
"#,
    );
    fixture.write(
        "datasource/acme_hubspot_source.yaml",
        r#"source_code: acme_hubspot_source
display_name: Acme HubSpot Source
auth_modes:
  - oauth2
capabilities:
  - validate_config
  - test_connection
  - discover_catalog
  - describe_resource
  - preview_read
  - import_snapshot
supports_sync: true
supports_webhook: false
resource_kinds:
  - object
config_schema:
  - key: client_id
    label: Client ID
    type: string
    required: true
"#,
    );

    let package = DataSourcePackage::load_from_dir(fixture.path()).unwrap();
    assert_eq!(package.definition.source_code, "acme_hubspot_source");
}
```

Create `api/crates/plugin-framework/src/_tests/data_source_contract_tests.rs`:

```rust
use plugin_framework::data_source_contract::DataSourceStdioMethod;

#[test]
fn data_source_stdio_methods_are_stable() {
    assert_eq!(serde_json::to_string(&DataSourceStdioMethod::ValidateConfig).unwrap(), "\"validate_config\"");
    assert_eq!(serde_json::to_string(&DataSourceStdioMethod::ImportSnapshot).unwrap(), "\"import_snapshot\"");
}
```

Wire both in `_tests/mod.rs`:

```rust
mod data_source_contract_tests;
mod data_source_package_tests;
```

- [x] **Step 2: Run the new plugin-framework tests to verify failure**

Run:

```bash
cargo test --manifest-path api/Cargo.toml -p plugin-framework data_source_package -- --nocapture
```

Expected:

- FAIL because `DataSourcePackage` and `data_source_contract` do not exist yet.

- [x] **Step 3: Implement the dedicated data-source contract and package loader**

Create `api/crates/plugin-framework/src/data_source_contract.rs` with a dedicated runtime protocol:

```rust
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum DataSourceStdioMethod {
    ValidateConfig,
    TestConnection,
    DiscoverCatalog,
    DescribeResource,
    PreviewRead,
    ImportSnapshot,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct DataSourceCatalogEntry {
    pub resource_key: String,
    pub display_name: String,
    pub resource_kind: String,
    pub metadata: serde_json::Value,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct DataSourceResourceDescriptor {
    pub resource_key: String,
    pub primary_key: Option<String>,
    pub fields: Vec<PluginFormFieldSchema>,
    pub supports_preview_read: bool,
    pub supports_import_snapshot: bool,
    pub metadata: serde_json::Value,
}
```

Create `api/crates/plugin-framework/src/data_source_package.rs` with a dedicated loader:

```rust
pub struct DataSourceDefinition {
    pub source_code: String,
    pub display_name: String,
    pub auth_modes: Vec<String>,
    pub capabilities: Vec<String>,
    pub supports_sync: bool,
    pub supports_webhook: bool,
    pub resource_kinds: Vec<String>,
    pub config_schema: Vec<PluginFormFieldSchema>,
}

pub struct DataSourcePackage {
    pub root: PathBuf,
    pub manifest: PluginManifestV1,
    pub definition: DataSourceDefinition,
}
```

Validation rules must enforce:

```rust
if manifest.consumption_kind != PluginConsumptionKind::RuntimeExtension { ... }
if !manifest.slot_codes.iter().any(|slot| slot == "data_source") { ... }
if manifest.contract_version != "1flowbase.data_source/v1" { ... }
if manifest.execution_mode != PluginExecutionMode::ProcessPerCall { ... }
if manifest.runtime.protocol != "stdio_json" { ... }
```

Export both from `api/crates/plugin-framework/src/lib.rs`.

- [x] **Step 4: Re-run the new plugin-framework tests**

Run:

```bash
cargo test --manifest-path api/Cargo.toml -p plugin-framework data_source_contract -- --nocapture
cargo test --manifest-path api/Cargo.toml -p plugin-framework data_source_package -- --nocapture
```

Expected:

- PASS with the new contract and package loader rooted.

- [x] **Step 5: Commit the plugin-framework contract root**

```bash
git add api/crates/plugin-framework
git commit -m "feat: add data source plugin contract root"
```

### Task 2: Add `DataSourceHost` And Plugin-Runner Runtime Routes

**Files:**
- Create: `api/apps/plugin-runner/src/data_source_host.rs`
- Create: `api/apps/plugin-runner/tests/data_source_runtime_routes.rs`
- Modify: `api/apps/plugin-runner/src/lib.rs`

- [ ] **Step 1: Write failing route tests for the new host**

Create `api/apps/plugin-runner/tests/data_source_runtime_routes.rs` with a temp package whose executable speaks the new methods:

```rust
#[tokio::test]
async fn validates_and_discovers_catalog_through_data_source_routes() {
    let package = TempDataSourcePackage::new();
    write_fixture_runtime(&package);

    let app = plugin_runner::app();

    let load_response = app
        .clone()
        .oneshot(
            Request::builder()
                .method(Method::POST)
                .uri("/data-sources/load")
                .header("content-type", "application/json")
                .body(Body::from(json!({ "package_root": package.path() }).to_string()))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(load_response.status(), StatusCode::OK);
}
```

Also add route-level checks for:

1. `/data-sources/validate-config`
2. `/data-sources/test-connection`
3. `/data-sources/discover-catalog`
4. `/data-sources/describe-resource`
5. `/data-sources/preview-read`
6. `/data-sources/import-snapshot`

- [ ] **Step 2: Run the new plugin-runner tests to verify failure**

Run:

```bash
cargo test --manifest-path api/Cargo.toml -p plugin-runner data_source_runtime_routes -- --nocapture
```

Expected:

- FAIL because the host and routes do not exist yet.

- [ ] **Step 3: Implement `DataSourceHost` And Expose Runtime Routes**

Create `api/apps/plugin-runner/src/data_source_host.rs`:

```rust
#[derive(Default)]
pub struct DataSourceHost {
    packages: BTreeMap<String, DataSourcePackage>,
    runtimes: BTreeMap<String, StdioRuntime>,
}

impl DataSourceHost {
    pub fn load(&mut self, package_root: &str) -> Result<LoadedDataSourceSummary, PluginFrameworkError> { ... }
    pub fn reload(&mut self, plugin_id: &str) -> Result<LoadedDataSourceSummary, PluginFrameworkError> { ... }
    pub async fn validate_config(&self, plugin_id: &str, config: Value) -> Result<DataSourceValueOutput, PluginFrameworkError> { ... }
    pub async fn test_connection(&self, plugin_id: &str, config: Value) -> Result<DataSourceValueOutput, PluginFrameworkError> { ... }
    pub async fn discover_catalog(&self, plugin_id: &str, config: Value) -> Result<DataSourceCatalogOutput, PluginFrameworkError> { ... }
    pub async fn describe_resource(&self, plugin_id: &str, config: Value, resource_key: String) -> Result<DataSourceDescriptorOutput, PluginFrameworkError> { ... }
    pub async fn preview_read(&self, plugin_id: &str, input: DataSourcePreviewReadInput) -> Result<DataSourcePreviewReadOutput, PluginFrameworkError> { ... }
    pub async fn import_snapshot(&self, plugin_id: &str, input: DataSourceImportSnapshotInput) -> Result<DataSourceImportSnapshotOutput, PluginFrameworkError> { ... }
}
```

Extend `api/apps/plugin-runner/src/lib.rs`:

```rust
pub mod data_source_host;

#[derive(Debug, Clone, Default)]
pub struct AppState {
    provider_host: Arc<RwLock<ProviderHost>>,
    capability_host: Arc<RwLock<CapabilityHost>>,
    data_source_host: Arc<RwLock<DataSourceHost>>,
}
```

Add routes:

```rust
.route("/data-sources/load", post(load_data_source))
.route("/data-sources/reload", post(reload_data_source))
.route("/data-sources/validate-config", post(validate_data_source_config))
.route("/data-sources/test-connection", post(test_data_source_connection))
.route("/data-sources/discover-catalog", post(discover_data_source_catalog))
.route("/data-sources/describe-resource", post(describe_data_source_resource))
.route("/data-sources/preview-read", post(preview_data_source_read))
.route("/data-sources/import-snapshot", post(import_data_source_snapshot))
```

- [ ] **Step 4: Re-run the plugin-runner data-source tests**

Run:

```bash
cargo test --manifest-path api/Cargo.toml -p plugin-runner data_source_runtime_routes -- --nocapture
```

Expected:

- PASS with the new host and route surface rooted.

- [ ] **Step 5: Commit the runner host**

```bash
git add api/apps/plugin-runner
git commit -m "feat: add data source plugin runner host"
```
