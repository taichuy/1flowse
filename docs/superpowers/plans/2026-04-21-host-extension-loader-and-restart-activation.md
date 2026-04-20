# Host Extension Loader And Restart Activation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the real `HostExtension` path around `filesystem_dropin`, uploaded `pending_restart`, startup reconcile, and restart-time activation without allowing third-party hot load or hot unload in the host process.

**Architecture:** Keep `HostExtension` as a special host-owned path. `plugin-framework` scans and validates `plugins/host-extension/dropins/`, the control plane stores installation rows with `desired_state=pending_restart` for uploaded host extensions, and `api-server` performs startup reconcile plus one-shot activation before the HTTP app serves traffic. The loader only writes `runtime_status` and `last_load_error`; `availability_status` remains derived from the existing lifecycle plan.

**Tech Stack:** Rust (`plugin-framework`, `control-plane`, `storage-pg`, `api-server`), filesystem scanning, startup tests, targeted `cargo test`.

**Source Spec:** `docs/superpowers/specs/1flowbase/2026-04-20-plugin-architecture-and-node-contribution-design.md`, `docs/superpowers/specs/1flowbase/2026-04-19-plugin-trust-source-install-design.md`, `docs/superpowers/specs/1flowbase/modules/08-plugin-framework/README.md`

---

## File Structure

**Create**
- `api/crates/plugin-framework/src/host_extension_dropin.rs`
- `api/crates/plugin-framework/src/_tests/host_extension_dropin_tests.rs`
- `api/apps/api-server/src/host_extension_loader.rs`
- `api/apps/api-server/src/_tests/host_extension_loader_tests.rs`
- `api/crates/control-plane/src/host_extension.rs`
- `api/crates/control-plane/src/_tests/host_extension_service_tests.rs`

**Modify**
- `api/crates/plugin-framework/src/lib.rs`
- `api/crates/control-plane/src/lib.rs`
- `api/crates/control-plane/src/plugin_management.rs`
- `api/crates/control-plane/src/ports.rs`
- `api/crates/storage-pg/src/plugin_repository.rs`
- `api/crates/storage-pg/src/_tests/plugin_repository_tests.rs`
- `api/apps/api-server/src/lib.rs`
- `api/apps/api-server/src/routes/plugins.rs`
- `api/apps/api-server/src/_tests/plugin_routes.rs`

**Notes**
- This plan depends on `2026-04-20-plugin-derived-availability-and-reconcile.md`; do not reintroduce direct writes to `availability_status`.
- `HostExtension` remains startup-only. No hot reload, no hot unload, and no generic marketplace consumer surface.
- Uploaded host extensions must stay `pending_restart` until a real process restart performs activation.

### Task 1: Scan And Reconcile `filesystem_dropin` Host Extensions

**Files:**
- Create: `api/crates/plugin-framework/src/host_extension_dropin.rs`
- Create: `api/crates/plugin-framework/src/_tests/host_extension_dropin_tests.rs`
- Modify: `api/crates/plugin-framework/src/lib.rs`

- [ ] **Step 1: Write failing drop-in scanner tests**

Create tests like:

```rust
#[test]
fn scan_dropins_accepts_signed_host_extension_package() {
    let result = scan_host_extension_dropins("src/_tests/fixtures/host_dropins").unwrap();

    assert_eq!(result.installations.len(), 1);
    assert_eq!(result.installations[0].source_kind, "filesystem_dropin");
}

#[test]
fn scan_dropins_rejects_unverified_package_when_policy_disallows_it() {
    let error = scan_host_extension_dropins_with_policy(
        "src/_tests/fixtures/unverified_host_dropins",
        HostExtensionDropinPolicy {
            allow_unverified_filesystem_dropins: false,
        },
    )
    .unwrap_err();

    assert!(error.to_string().contains("filesystem_dropin"));
}
```

- [ ] **Step 2: Run RED verification**

Run:

```bash
cargo test --manifest-path api/Cargo.toml -p plugin-framework host_extension_dropin -- --nocapture
```

Expected:

- FAIL because there is no dedicated drop-in scanner or host-extension policy adapter yet.

- [ ] **Step 3: Implement drop-in scanning and policy validation**

Create a scanner shaped like:

```rust
pub struct HostExtensionDropinScan {
    pub installations: Vec<DetectedHostExtensionInstallation>,
    pub warnings: Vec<String>,
}

pub fn scan_host_extension_dropins(
    dropin_root: impl AsRef<Path>,
) -> FrameworkResult<HostExtensionDropinScan> {
    ...
}
```

Rules must include:

```rust
if manifest.consumption_kind != PluginConsumptionKind::HostExtension {
    return Err(PluginFrameworkError::invalid_provider_package(
        "filesystem drop-in package must declare consumption_kind=host_extension",
    ));
}
if manifest.source_kind != "filesystem_dropin" {
    return Err(PluginFrameworkError::invalid_provider_package(
        "drop-in package must resolve to source_kind=filesystem_dropin",
    ));
}
```

- [ ] **Step 4: Re-run the drop-in scanner tests**

Run:

```bash
cargo test --manifest-path api/Cargo.toml -p plugin-framework host_extension_dropin -- --nocapture
```

Expected:

- PASS with `filesystem_dropin` scans producing installable host-extension snapshots.

- [ ] **Step 5: Commit the drop-in scanner**

```bash
git add api/crates/plugin-framework/src/lib.rs api/crates/plugin-framework/src/host_extension_dropin.rs api/crates/plugin-framework/src/_tests/host_extension_dropin_tests.rs
git commit -m "feat: scan host extension filesystem dropins"
```

### Task 2: Persist Uploaded Host Extensions As `pending_restart`

**Files:**
- Create: `api/crates/control-plane/src/host_extension.rs`
- Create: `api/crates/control-plane/src/_tests/host_extension_service_tests.rs`
- Modify: `api/crates/control-plane/src/lib.rs`
- Modify: `api/crates/control-plane/src/plugin_management.rs`
- Modify: `api/crates/control-plane/src/ports.rs`
- Modify: `api/crates/storage-pg/src/plugin_repository.rs`
- Modify: `api/crates/storage-pg/src/_tests/plugin_repository_tests.rs`
- Modify: `api/apps/api-server/src/routes/plugins.rs`
- Modify: `api/apps/api-server/src/_tests/plugin_routes.rs`

- [ ] **Step 1: Write failing service and route tests**

Add cases like:

```rust
#[tokio::test]
async fn uploaded_host_extension_is_saved_as_pending_restart() {
    let result = service.install_uploaded_plugin(command).await.unwrap();

    assert_eq!(result.installation.desired_state.as_str(), "pending_restart");
    assert_eq!(result.installation.runtime_status.as_str(), "inactive");
}

#[tokio::test]
async fn non_root_cannot_upload_host_extension() {
    let response = install_uploaded_plugin_as_non_root().await;

    assert_eq!(response.status(), StatusCode::FORBIDDEN);
}
```

- [ ] **Step 2: Run RED verification**

Run:

```bash
cargo test --manifest-path api/Cargo.toml -p control-plane host_extension_service -- --nocapture
cargo test --manifest-path api/Cargo.toml -p api-server plugin_routes -- --nocapture
```

Expected:

- FAIL because uploaded installs currently follow the provider path and do not branch on `consumption_kind=host_extension`.

- [ ] **Step 3: Split host-extension install semantics from generic provider enable semantics**

Keep the install branch explicit:

```rust
if intake.manifest.consumption_kind == PluginConsumptionKind::HostExtension {
    ensure_root_actor(&actor)?;
    ensure_uploaded_host_extensions_enabled()?;
    installation.desired_state = PluginDesiredState::PendingRestart;
    installation.runtime_status = PluginRuntimeStatus::Inactive;
    task.status_message = Some("installed; restart required".into());
    return Ok(InstallPluginResult { installation, task });
}
```

And make route wording explicit:

```rust
pub struct PluginInstallationResponse {
    ...
    pub desired_state: String,
    pub artifact_status: String,
    pub runtime_status: String,
    pub availability_status: String,
}
```

- [ ] **Step 4: Re-run service and route tests**

Run:

```bash
cargo test --manifest-path api/Cargo.toml -p control-plane host_extension_service -- --nocapture
cargo test --manifest-path api/Cargo.toml -p api-server plugin_routes -- --nocapture
```

Expected:

- PASS with uploaded host extensions entering `pending_restart` and never self-activating in the request path.

- [ ] **Step 5: Commit the upload semantics**

```bash
git add api/crates/control-plane/src/lib.rs api/crates/control-plane/src/ports.rs api/crates/control-plane/src/plugin_management.rs api/crates/control-plane/src/host_extension.rs api/crates/control-plane/src/_tests/host_extension_service_tests.rs api/crates/storage-pg/src/plugin_repository.rs api/crates/storage-pg/src/_tests/plugin_repository_tests.rs api/apps/api-server/src/routes/plugins.rs api/apps/api-server/src/_tests/plugin_routes.rs
git commit -m "feat: persist uploaded host extensions as pending restart"
```

### Task 3: Activate Host Extensions During Startup Reconcile Only

**Files:**
- Create: `api/apps/api-server/src/host_extension_loader.rs`
- Create: `api/apps/api-server/src/_tests/host_extension_loader_tests.rs`
- Modify: `api/apps/api-server/src/lib.rs`

- [ ] **Step 1: Write failing startup-loader tests**

Add tests like:

```rust
#[tokio::test]
async fn startup_loader_scans_dropins_and_pending_restart_rows_before_serving() {
    let state = build_state_with_pending_restart_host_extension();

    let summary = load_host_extensions_at_startup(&state).await.unwrap();

    assert_eq!(summary.loaded_count, 1);
}

#[tokio::test]
async fn startup_loader_only_writes_runtime_status_on_failure() {
    let summary = load_host_extensions_at_startup(&state_with_broken_extension()).await.unwrap();

    assert_eq!(summary.failed_count, 1);
    assert_eq!(fetch_installation().availability_status.as_str(), "load_failed");
}
```

- [ ] **Step 2: Run RED verification**

Run:

```bash
cargo test --manifest-path api/Cargo.toml -p api-server host_extension_loader -- --nocapture
```

Expected:

- FAIL because `api-server` startup does not have a host-extension loader phase.

- [ ] **Step 3: Implement startup reconcile and one-shot activation**

Create a startup helper:

```rust
pub async fn load_host_extensions_at_startup(
    state: &ApiState,
) -> anyhow::Result<HostExtensionStartupSummary> {
    let detected = scan_host_extension_dropins(&state.host_extension_dropin_root)?;
    let pending = state.store.list_pending_restart_host_extensions().await?;
    ...
}
```

Critical rule:

```rust
repository
    .update_plugin_runtime_snapshot(UpdatePluginRuntimeSnapshotInput {
        installation_id,
        runtime_status,
        last_load_error,
    })
    .await?;
```

Do not let the startup loader write `availability_status` directly.

- [ ] **Step 4: Re-run startup verification**

Run:

```bash
cargo test --manifest-path api/Cargo.toml -p api-server host_extension_loader -- --nocapture
git diff --check
```

Expected:

- PASS with host extensions loaded only during startup, runtime failures captured in `runtime_status`, and no request-time auto-activation path added.

- [ ] **Step 5: Commit the startup loader**

```bash
git add api/apps/api-server/src/lib.rs api/apps/api-server/src/host_extension_loader.rs api/apps/api-server/src/_tests/host_extension_loader_tests.rs
git commit -m "feat: load host extensions during startup reconcile"
```

## Self-Review

- Spec coverage: this plan covers `filesystem_dropin`, uploaded `pending_restart`, startup scan, startup activation, and the rule that loader writes only `runtime_status`.
- Placeholder scan: every stage names the concrete loader, repository, and route files.
- Type consistency: `HostExtension`, `filesystem_dropin`, `pending_restart`, `runtime_status`, and `last_load_error` remain stable across tasks.
