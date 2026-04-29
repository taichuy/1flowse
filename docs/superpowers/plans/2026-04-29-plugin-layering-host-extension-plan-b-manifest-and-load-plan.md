# Plugin Layering Host Extension Plan B Manifest And Load Plan Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add HostExtension contribution metadata and load-plan validation so installed HostExtensions cannot become active by file-existence checks alone.

**Architecture:** Extend `plugin-framework` with `host-extension.yaml` parsing and contribution structs. Then update control-plane/api-server boot validation to require package manifest plus contribution manifest, build a phase-aware load plan, and mark invalid extensions `load_failed`.

**Tech Stack:** Rust, serde_yaml, plugin-framework, control-plane, api-server startup tests, targeted Cargo tests.

**Status:** Complete on 2026-04-29. Implementation commits:
`f32161db`, `1684df19`, `35f84340`, `71e761cb`.

---

## File Structure

**Create**
- `api/crates/plugin-framework/src/host_extension_contribution.rs`: parses and validates `host-extension.yaml`.
- `api/crates/plugin-framework/src/_tests/host_extension_contribution_tests.rs`: contribution manifest contract tests.

**Modify**
- `api/crates/plugin-framework/src/lib.rs`: export contribution types.
- `api/crates/plugin-framework/src/host_extension_registry.rs`: store declared contributions, phases, and provider declarations.
- `api/crates/plugin-framework/src/_tests/mod.rs`: include new tests.
- `api/crates/plugin-framework/src/_tests/host_extension_registry_tests.rs`: duplicate and invalid contribution checks.
- `api/crates/control-plane/src/host_extension_boot/loader.rs`: phase-aware load plan.
- `api/crates/control-plane/src/_tests/host_extension_boot_tests.rs`: load plan tests.
- `api/apps/api-server/src/host_extension_loader.rs`: validate `host-extension.yaml` and failure states.
- `api/apps/api-server/src/_tests/host_extension_loader_tests.rs`: startup validation tests.

### Task 1: Add Contribution Manifest Tests

**Files:**
- Create: `api/crates/plugin-framework/src/_tests/host_extension_contribution_tests.rs`
- Modify: `api/crates/plugin-framework/src/_tests/mod.rs`

- [x] **Step 1: Write RED tests**

Add tests covering valid manifest parsing and rejection of undeclared empty identifiers:

```rust
use plugin_framework::parse_host_extension_contribution_manifest;

#[test]
fn parses_pre_state_infrastructure_provider_manifest() {
    let raw = r#"
schema_version: 1flowbase.host-extension/v1
extension_id: redis-infra-host
version: 0.1.0
bootstrap_phase: pre_state
native:
  abi_version: 1flowbase.host.native/v1
  library: lib/redis_infra_host
  entry_symbol: oneflowbase_host_extension_entry_v1
owned_resources: []
extends_resources: []
infrastructure_providers:
  - contract: storage-ephemeral
    provider_code: redis
    config_ref: secret://system/redis-infra-host/config
routes: []
workers: []
migrations: []
"#;

    let manifest = parse_host_extension_contribution_manifest(raw).unwrap();

    assert_eq!(manifest.extension_id, "redis-infra-host");
    assert_eq!(manifest.bootstrap_phase.as_str(), "pre_state");
    assert_eq!(manifest.infrastructure_providers[0].contract, "storage-ephemeral");
}

#[test]
fn rejects_unknown_schema_version() {
    let raw = r#"
schema_version: wrong/v1
extension_id: redis-infra-host
version: 0.1.0
bootstrap_phase: pre_state
native:
  abi_version: 1flowbase.host.native/v1
  library: lib/redis_infra_host
  entry_symbol: oneflowbase_host_extension_entry_v1
owned_resources: []
extends_resources: []
infrastructure_providers: []
routes: []
workers: []
migrations: []
"#;

    let err = parse_host_extension_contribution_manifest(raw).unwrap_err();
    assert!(err.to_string().contains("schema_version"));
}
```

- [x] **Step 2: Run RED verification**

Run:

```bash
cd api
cargo test -p plugin-framework host_extension_contribution -- --nocapture
```

Expected: FAIL because `parse_host_extension_contribution_manifest` does not exist.

### Task 2: Implement Contribution Manifest Parser

**Files:**
- Create: `api/crates/plugin-framework/src/host_extension_contribution.rs`
- Modify: `api/crates/plugin-framework/src/lib.rs`

- [x] **Step 1: Add structs and parser**

Implement structs with `#[serde(deny_unknown_fields)]`:

```rust
#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum HostExtensionBootstrapPhase {
    PreState,
    Boot,
}

#[derive(Debug, Clone, PartialEq, Eq, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct HostExtensionNativeEntrypointManifest {
    pub abi_version: String,
    pub library: String,
    pub entry_symbol: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct HostInfrastructureProviderManifest {
    pub contract: String,
    pub provider_code: String,
    pub config_ref: String,
}
```

The root struct must include:

```rust
pub schema_version: String,
pub extension_id: String,
pub version: String,
pub bootstrap_phase: HostExtensionBootstrapPhase,
pub native: HostExtensionNativeEntrypointManifest,
pub owned_resources: Vec<String>,
pub extends_resources: Vec<String>,
pub infrastructure_providers: Vec<HostInfrastructureProviderManifest>,
pub routes: Vec<String>,
pub workers: Vec<String>,
pub migrations: Vec<String>,
```

Validation rules:

```text
schema_version == 1flowbase.host-extension/v1
native.abi_version == 1flowbase.host.native/v1
extension_id, version, library, entry_symbol are non-empty
provider contract and provider_code are non-empty
provider config_ref must start with secret://system/
```

- [x] **Step 2: Re-run parser tests**

Run:

```bash
cd api
cargo test -p plugin-framework host_extension_contribution -- --nocapture
```

Expected: PASS.

- [x] **Step 3: Commit parser**

```bash
git add api/crates/plugin-framework/src/host_extension_contribution.rs api/crates/plugin-framework/src/lib.rs api/crates/plugin-framework/src/_tests
git commit -m "feat: parse host extension contribution manifests"
```

### Task 3: Extend Registry And Load Plan

**Files:**
- Modify: `api/crates/plugin-framework/src/host_extension_registry.rs`
- Modify: `api/crates/plugin-framework/src/_tests/host_extension_registry_tests.rs`
- Modify: `api/crates/control-plane/src/host_extension_boot/loader.rs`
- Modify: `api/crates/control-plane/src/_tests/host_extension_boot_tests.rs`

- [x] **Step 1: Write registry/load-plan tests**

Add tests for:

```text
duplicate infrastructure provider for the same contract/provider_code is rejected
two default providers for storage-ephemeral in one profile are rejected
pre_state load plan items are returned before boot items
missing dependency returns host_extension_dependency not found
```

Use fixture items named:

```text
local-infra-host
redis-infra-host
official.plugin-host
official.file-management-host
```

- [x] **Step 2: Run RED verification**

Run:

```bash
cd api
cargo test -p plugin-framework host_extension_registry -- --nocapture
cargo test -p control-plane host_extension_boot -- --nocapture
```

Expected: FAIL on missing contribution fields or phase-aware ordering.

- [x] **Step 3: Implement registry fields**

Extend `RegisteredHostExtension` with:

```rust
pub bootstrap_phase: HostExtensionBootstrapPhase,
pub infrastructure_providers: Vec<HostInfrastructureProviderManifest>,
pub owned_resources: Vec<String>,
pub extends_resources: Vec<String>,
pub routes: Vec<String>,
pub workers: Vec<String>,
pub migrations: Vec<String>,
```

Store providers by `(contract, provider_code)` and expose:

```rust
pub fn infrastructure_provider(&self, contract: &str, provider_code: &str) -> Option<&RegisteredInfrastructureProvider>
pub fn providers_for_contract(&self, contract: &str) -> Vec<&RegisteredInfrastructureProvider>
```

- [x] **Step 4: Implement phase-aware load plan**

In `control-plane/src/host_extension_boot/loader.rs`, include `bootstrap_phase` on `HostExtensionLoadPlanItem` and sort resolved items by:

```text
dependency order first
pre_state before boot when no dependency conflicts
extension_id for deterministic ties
```

- [x] **Step 5: Re-run tests**

Run:

```bash
cd api
cargo test -p plugin-framework host_extension_registry -- --nocapture
cargo test -p control-plane host_extension_boot -- --nocapture
```

Expected: PASS.

- [x] **Step 6: Commit registry/load plan**

```bash
git add api/crates/plugin-framework/src/host_extension_registry.rs api/crates/plugin-framework/src/_tests/host_extension_registry_tests.rs api/crates/control-plane/src/host_extension_boot/loader.rs api/crates/control-plane/src/_tests/host_extension_boot_tests.rs
git commit -m "feat: add phase-aware host extension load plan"
```

### Task 4: Require Contribution Manifest During Startup

**Files:**
- Modify: `api/apps/api-server/src/host_extension_loader.rs`
- Modify: `api/apps/api-server/src/_tests/host_extension_loader_tests.rs`

- [x] **Step 1: Add startup validation tests**

Add tests proving:

```text
installed host extension without host-extension.yaml becomes load_failed
invalid host-extension.yaml becomes load_failed with last_load_error
valid manifest + valid contribution manifest becomes active
entry file existence alone is insufficient
```

- [x] **Step 2: Run RED verification**

Run:

```bash
cd api
cargo test -p api-server host_extension_loader -- --nocapture
```

Expected: FAIL because loader only checks `manifest.runtime.entry`.

- [x] **Step 3: Implement validation**

Change loader validation to:

```text
read manifest.yaml
parse PluginManifestV1
verify consumption_kind == host_extension
resolve runtime.entry as host-extension.yaml
parse HostExtensionContributionManifest
verify manifest.plugin_code/version matches contribution extension_id/version
verify native.library path exists only after contribution manifest validates
```

- [x] **Step 4: Re-run startup tests**

Run:

```bash
cd api
cargo test -p api-server host_extension_loader -- --nocapture
```

Expected: PASS.

- [x] **Step 5: Commit startup validation**

```bash
git add api/apps/api-server/src/host_extension_loader.rs api/apps/api-server/src/_tests/host_extension_loader_tests.rs
git commit -m "feat: validate host extension contribution manifests at startup"
```

### Task 5: Plan B Verification

**Files:**
- Verify only.

- [x] **Step 1: Format**

Run:

```bash
cd api
cargo fmt
```

Expected: no diff after formatting.

- [x] **Step 2: Run focused tests**

Run:

```bash
cd api
cargo test -p plugin-framework host_extension -- --nocapture
cargo test -p control-plane host_extension_boot -- --nocapture
cargo test -p api-server host_extension -- --nocapture
```

Expected: PASS.

- [x] **Step 3: Commit any formatting changes**

If `git status --short` shows formatting changes, run:

```bash
git add api
git commit -m "style: format host extension manifest changes"
```

Expected: clean worktree.
