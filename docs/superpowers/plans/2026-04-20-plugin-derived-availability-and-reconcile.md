# Plugin Derived Availability And Reconcile Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade the existing provider-plugin install and consumption path from `enabled + install_path` to the finalized four-layer lifecycle model (`desired_state`, `artifact_status`, `runtime_status`, `availability_status`) with derived availability and reconcile checks, then expose that contract through the current model-provider settings surface.

**Architecture:** Keep the current `model_provider` package contract and settings page as the first implementation surface instead of trying to land generic node contributions in the same round. `plugin-framework` owns artifact fingerprinting and filesystem reconcile, `control-plane` owns lifecycle writes plus `availability_status` derivation, and `api-server` / `plugin-runner` only load installed artifacts after a critical-load reconcile. Browser contracts stop relying on raw filesystem paths and `enabled`; they render lifecycle status labels derived from the new backend fields.

**Tech Stack:** Rust (`domain`, `plugin-framework`, `control-plane`, `storage-pg`, `api-server`, `plugin-runner`), PostgreSQL migrations with `sqlx`, TypeScript React (`TanStack Query`, `Ant Design`), Vitest, targeted `cargo test`, targeted `pnpm exec vitest`

**Source Spec:** `docs/superpowers/specs/1flowbase/2026-04-20-plugin-architecture-and-node-contribution-design.md`, `docs/superpowers/specs/1flowbase/2026-04-19-plugin-trust-source-install-design.md`, `docs/superpowers/specs/1flowbase/modules/08-plugin-framework/README.md`, `.memory/project-memory/2026-04-20-plugin-kind-vs-execution-mode-evaluation.md`

**Execution Note:** This plan intentionally upgrades the already-shipped provider-plugin line first. Generic `plugin manifest v1`, `node_contribution_registry`, `capability_plugin` runtime, and the real `host_extension` loader remain follow-up plans; however, `pending_restart` and the derived availability model must land now so those later plans do not need another storage/API migration.

**Out Of Scope:** Canvas node contribution execution, marketplace UX beyond `/settings/model-providers`, hot unload, in-process third-party code, automatic migration of legacy rows into fully reconstructable `package_path` archives

---

## File Structure

**Create**
- `api/crates/storage-pg/migrations/20260420203000_add_plugin_lifecycle_snapshots.sql`
- `api/crates/plugin-framework/src/artifact_reconcile.rs`
- `api/crates/plugin-framework/src/_tests/artifact_reconcile_tests.rs`
- `api/crates/control-plane/src/plugin_lifecycle.rs`
- `web/app/src/features/settings/components/model-providers/plugin-installation-status.ts`
- `docs/superpowers/plans/2026-04-20-plugin-derived-availability-and-reconcile.md`

**Modify**
- `api/crates/plugin-framework/src/lib.rs`
- `api/crates/plugin-framework/src/provider_package.rs`
- `api/crates/domain/src/model_provider.rs`
- `api/crates/control-plane/src/lib.rs`
- `api/crates/control-plane/src/ports.rs`
- `api/crates/control-plane/src/plugin_management.rs`
- `api/crates/control-plane/src/model_provider.rs`
- `api/crates/control-plane/src/orchestration_runtime.rs`
- `api/crates/control-plane/src/_tests/plugin_management_service_tests.rs`
- `api/crates/control-plane/src/_tests/model_provider_service_tests.rs`
- `api/crates/control-plane/src/_tests/orchestration_runtime_service_tests.rs`
- `api/crates/storage-pg/src/mappers/plugin_mapper.rs`
- `api/crates/storage-pg/src/plugin_repository.rs`
- `api/crates/storage-pg/src/_tests/plugin_repository_tests.rs`
- `api/crates/storage-pg/src/_tests/migration_smoke.rs`
- `api/apps/api-server/src/lib.rs`
- `api/apps/api-server/src/provider_runtime.rs`
- `api/apps/api-server/src/routes/plugins.rs`
- `api/apps/api-server/src/routes/model_providers.rs`
- `api/apps/api-server/src/openapi.rs`
- `api/apps/api-server/src/_tests/plugin_routes.rs`
- `api/apps/api-server/src/_tests/model_provider_routes.rs`
- `web/packages/api-client/src/console-plugins.ts`
- `web/packages/api-client/src/console-model-providers.ts`
- `web/app/src/features/settings/api/plugins.ts`
- `web/app/src/features/settings/api/model-providers.ts`
- `web/app/src/features/settings/pages/SettingsPage.tsx`
- `web/app/src/features/settings/components/model-providers/ModelProviderCatalogPanel.tsx`
- `web/app/src/features/settings/components/model-providers/OfficialPluginInstallPanel.tsx`
- `web/app/src/features/settings/components/model-providers/PluginUploadInstallModal.tsx`
- `web/app/src/features/settings/components/model-providers/PluginVersionManagementModal.tsx`
- `web/app/src/features/settings/_tests/model-providers-page.test.tsx`

**Notes**
- `availability_status` remains persisted as a derived snapshot, but no route, UI, or caller may write it directly.
- Split write ownership: control plane changes only `desired_state`; reconcile changes only artifact snapshot fields; runtime load paths change only `runtime_status` and `last_load_error`.
- Existing rows with no real archived package file should be backfilled to `artifact_status=install_incomplete` and made recoverable through explicit reinstall or version switch; do not invent fake `package_path` values.
- Browser responses should stop returning raw host filesystem paths.
- During execution, update this plan file after every completed task so the user can track progress in `docs/superpowers/plans`.

### Task 1: Replace Legacy Install Flags With Lifecycle Snapshots

**Files:**
- Create: `api/crates/storage-pg/migrations/20260420203000_add_plugin_lifecycle_snapshots.sql`
- Modify: `api/crates/domain/src/model_provider.rs`
- Modify: `api/crates/control-plane/src/ports.rs`
- Modify: `api/crates/storage-pg/src/mappers/plugin_mapper.rs`
- Modify: `api/crates/storage-pg/src/plugin_repository.rs`
- Test: `api/crates/storage-pg/src/_tests/plugin_repository_tests.rs`
- Test: `api/crates/storage-pg/src/_tests/migration_smoke.rs`

- [ ] **Step 1: Write failing storage tests for lifecycle fields and renamed task terminal states**

Add tests like these to `api/crates/storage-pg/src/_tests/plugin_repository_tests.rs`:

```rust
#[tokio::test]
async fn plugin_repository_persists_lifecycle_snapshot_fields() {
    let (store, _, actor) = seed_store().await;

    let installation = PluginRepository::upsert_installation(
        &store,
        &UpsertPluginInstallationInput {
            installation_id: Uuid::now_v7(),
            provider_code: "fixture_provider".into(),
            plugin_id: "fixture_provider@0.2.0".into(),
            plugin_version: "0.2.0".into(),
            contract_version: "1flowbase.provider/v1".into(),
            protocol: "openai_compatible".into(),
            display_name: "Fixture Provider".into(),
            source_kind: "uploaded".into(),
            trust_level: "unverified".into(),
            verification_status: PluginVerificationStatus::Valid,
            desired_state: PluginDesiredState::PendingRestart,
            artifact_status: PluginArtifactStatus::Ready,
            runtime_status: PluginRuntimeStatus::Inactive,
            availability_status: PluginAvailabilityStatus::PendingRestart,
            package_path: Some("/tmp/plugins/packages/fixture_provider@0.2.0.1flowbasepkg".into()),
            installed_path: "/tmp/plugins/installed/fixture_provider/0.2.0".into(),
            checksum: Some("sha256:artifact".into()),
            manifest_fingerprint: Some("sha256:manifest".into()),
            signature_status: Some("verified".into()),
            signature_algorithm: Some("ed25519".into()),
            signing_key_id: Some("official-key-2026-04".into()),
            last_load_error: None,
            metadata_json: json!({}),
            actor_user_id: actor.id,
        },
    )
    .await
    .unwrap();

    assert_eq!(installation.desired_state, PluginDesiredState::PendingRestart);
    assert_eq!(installation.artifact_status, PluginArtifactStatus::Ready);
    assert_eq!(installation.runtime_status, PluginRuntimeStatus::Inactive);
    assert_eq!(
        installation.availability_status,
        PluginAvailabilityStatus::PendingRestart
    );
    assert_eq!(
        installation.manifest_fingerprint.as_deref(),
        Some("sha256:manifest")
    );
}

#[tokio::test]
async fn plugin_repository_maps_succeeded_task_status() {
    let (store, _, actor) = seed_store().await;

    let task = PluginRepository::create_task(
        &store,
        &CreatePluginTaskInput {
            task_id: Uuid::now_v7(),
            installation_id: None,
            workspace_id: None,
            provider_code: "fixture_provider".into(),
            task_kind: PluginTaskKind::Install,
            status: PluginTaskStatus::Succeeded,
            status_message: Some("installed".into()),
            detail_json: json!({}),
            actor_user_id: Some(actor.id),
        },
    )
    .await
    .unwrap();

    assert_eq!(task.status, PluginTaskStatus::Succeeded);
}
```

- [ ] **Step 2: Run the storage tests to capture the RED baseline**

Run:

```bash
cargo test --manifest-path api/Cargo.toml -p storage-pg plugin_repository_ -- --nocapture
```

Expected:

- FAIL because `PluginInstallationRecord`, repository inputs, SQL mappers, and task status enums still use `enabled`, `install_path`, `pending`, and `success`.

- [ ] **Step 3: Add the migration that backfills lifecycle snapshots and replaces task terminal strings**

Create `api/crates/storage-pg/migrations/20260420203000_add_plugin_lifecycle_snapshots.sql` with:

```sql
update plugin_tasks
set status = 'queued'
where status = 'pending';

update plugin_tasks
set status = 'succeeded'
where status = 'success';

alter table plugin_installations
    rename column install_path to installed_path;

alter table plugin_installations
    add column desired_state text not null default 'disabled',
    add column artifact_status text not null default 'missing',
    add column runtime_status text not null default 'inactive',
    add column availability_status text not null default 'disabled',
    add column package_path text,
    add column manifest_fingerprint text,
    add column last_load_error text;

update plugin_installations
set desired_state = case when enabled then 'active_requested' else 'disabled' end,
    artifact_status = case when enabled then 'install_incomplete' else 'missing' end,
    runtime_status = 'inactive',
    availability_status = case when enabled then 'install_incomplete' else 'disabled' end,
    package_path = null,
    manifest_fingerprint = null,
    last_load_error = null;

alter table plugin_installations
    drop column enabled;

alter table plugin_installations
    add constraint plugin_installations_desired_state_check
        check (desired_state in ('disabled', 'pending_restart', 'active_requested')),
    add constraint plugin_installations_artifact_status_check
        check (artifact_status in ('missing', 'staged', 'ready', 'corrupted', 'install_incomplete')),
    add constraint plugin_installations_runtime_status_check
        check (runtime_status in ('inactive', 'active', 'load_failed')),
    add constraint plugin_installations_availability_status_check
        check (availability_status in ('disabled', 'pending_restart', 'artifact_missing', 'install_incomplete', 'load_failed', 'available'));

alter table plugin_tasks
    drop constraint plugin_tasks_status_check;

alter table plugin_tasks
    add constraint plugin_tasks_status_check
        check (status in ('queued', 'running', 'succeeded', 'failed', 'canceled', 'timed_out'));
```

- [ ] **Step 4: Update domain and repository contracts so legacy booleans disappear from the write path**

Apply these shapes:

```rust
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum PluginDesiredState {
    Disabled,
    PendingRestart,
    ActiveRequested,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum PluginArtifactStatus {
    Missing,
    Staged,
    Ready,
    Corrupted,
    InstallIncomplete,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum PluginRuntimeStatus {
    Inactive,
    Active,
    LoadFailed,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum PluginAvailabilityStatus {
    Disabled,
    PendingRestart,
    ArtifactMissing,
    InstallIncomplete,
    LoadFailed,
    Available,
}

pub struct PluginInstallationRecord {
    pub id: Uuid,
    pub provider_code: String,
    pub plugin_id: String,
    pub plugin_version: String,
    pub contract_version: String,
    pub protocol: String,
    pub display_name: String,
    pub source_kind: String,
    pub trust_level: String,
    pub verification_status: PluginVerificationStatus,
    pub desired_state: PluginDesiredState,
    pub artifact_status: PluginArtifactStatus,
    pub runtime_status: PluginRuntimeStatus,
    pub availability_status: PluginAvailabilityStatus,
    pub package_path: Option<String>,
    pub installed_path: String,
    pub checksum: Option<String>,
    pub manifest_fingerprint: Option<String>,
    pub signature_status: Option<String>,
    pub signature_algorithm: Option<String>,
    pub signing_key_id: Option<String>,
    pub last_load_error: Option<String>,
    pub metadata_json: serde_json::Value,
    pub created_by: Uuid,
    pub created_at: OffsetDateTime,
    pub updated_at: OffsetDateTime,
}

pub struct UpdatePluginDesiredStateInput {
    pub installation_id: Uuid,
    pub desired_state: domain::PluginDesiredState,
    pub availability_status: domain::PluginAvailabilityStatus,
}

pub struct UpdatePluginArtifactSnapshotInput {
    pub installation_id: Uuid,
    pub artifact_status: domain::PluginArtifactStatus,
    pub availability_status: domain::PluginAvailabilityStatus,
    pub package_path: Option<String>,
    pub installed_path: String,
    pub checksum: Option<String>,
    pub manifest_fingerprint: Option<String>,
}

pub struct UpdatePluginRuntimeSnapshotInput {
    pub installation_id: Uuid,
    pub runtime_status: domain::PluginRuntimeStatus,
    pub availability_status: domain::PluginAvailabilityStatus,
    pub last_load_error: Option<String>,
}
```

Repository SQL must insert/select/update the new columns and drop every read of `enabled` / `install_path`.

- [ ] **Step 5: Re-run storage tests and migration smoke**

Run:

```bash
cargo test --manifest-path api/Cargo.toml -p storage-pg plugin_repository_ -- --nocapture
cargo test --manifest-path api/Cargo.toml -p storage-pg migration_smoke -- --nocapture
```

Expected:

- PASS with lifecycle fields persisted and task statuses stored as `queued` / `succeeded`.

- [ ] **Step 6: Commit the lifecycle storage contract**

Run:

```bash
git add api/crates/domain/src/model_provider.rs api/crates/control-plane/src/ports.rs api/crates/storage-pg/migrations/20260420203000_add_plugin_lifecycle_snapshots.sql api/crates/storage-pg/src/mappers/plugin_mapper.rs api/crates/storage-pg/src/plugin_repository.rs api/crates/storage-pg/src/_tests/plugin_repository_tests.rs api/crates/storage-pg/src/_tests/migration_smoke.rs
git commit -m "feat: add plugin lifecycle snapshot storage"
```

### Task 2: Add Artifact Reconcile And Manifest Fingerprinting

**Files:**
- Create: `api/crates/plugin-framework/src/artifact_reconcile.rs`
- Create: `api/crates/plugin-framework/src/_tests/artifact_reconcile_tests.rs`
- Modify: `api/crates/plugin-framework/src/lib.rs`
- Modify: `api/crates/plugin-framework/src/provider_package.rs`

- [ ] **Step 1: Write failing reconcile tests for ready, missing, and corrupted artifacts**

Add tests like these to `api/crates/plugin-framework/src/_tests/artifact_reconcile_tests.rs`:

```rust
#[test]
fn reconcile_provider_artifact_reports_ready_when_manifest_and_checksums_match() {
    let fixture = create_artifact_fixture();
    let manifest_fingerprint =
        compute_manifest_fingerprint(&fixture.installed_path.join("manifest.yaml")).unwrap();

    let result = reconcile_provider_artifact(ArtifactReconcileInput {
        package_path: Some(fixture.package_path.as_path()),
        installed_path: fixture.installed_path.as_path(),
        expected_artifact_sha256: Some(fixture.package_sha256.as_str()),
        expected_manifest_fingerprint: Some(manifest_fingerprint.as_str()),
    })
    .unwrap();

    assert_eq!(result.outcome, ArtifactReconcileOutcome::Ready);
}

#[test]
fn reconcile_provider_artifact_reports_missing_when_installed_path_is_absent() {
    let temp = tempfile::tempdir().unwrap();

    let result = reconcile_provider_artifact(ArtifactReconcileInput {
        package_path: None,
        installed_path: &temp.path().join("missing-installed"),
        expected_artifact_sha256: None,
        expected_manifest_fingerprint: None,
    })
    .unwrap();

    assert_eq!(result.outcome, ArtifactReconcileOutcome::Missing);
}

#[test]
fn reconcile_provider_artifact_reports_corrupted_when_manifest_fingerprint_drifts() {
    let fixture = create_artifact_fixture();

    std::fs::write(
        fixture.installed_path.join("manifest.yaml"),
        "schema_version: 2\nplugin_type: model_provider\nplugin_code: tampered\n",
    )
    .unwrap();

    let result = reconcile_provider_artifact(ArtifactReconcileInput {
        package_path: Some(fixture.package_path.as_path()),
        installed_path: fixture.installed_path.as_path(),
        expected_artifact_sha256: Some(fixture.package_sha256.as_str()),
        expected_manifest_fingerprint: Some("sha256:original"),
    })
    .unwrap();

    assert_eq!(result.outcome, ArtifactReconcileOutcome::Corrupted);
}
```

- [ ] **Step 2: Run `plugin-framework` tests to capture the RED baseline**

Run:

```bash
cargo test --manifest-path api/Cargo.toml -p plugin-framework artifact_reconcile -- --nocapture
```

Expected:

- FAIL because the reconcile module, outcome enum, and manifest fingerprint helper do not exist.

- [ ] **Step 3: Implement the reconcile helper and manifest fingerprint function**

Create `api/crates/plugin-framework/src/artifact_reconcile.rs` with:

```rust
use std::path::Path;

use sha2::{Digest, Sha256};

use crate::error::PluginFrameworkError;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ArtifactReconcileOutcome {
    Missing,
    InstallIncomplete,
    Ready,
    Corrupted,
}

pub struct ArtifactReconcileInput<'a> {
    pub package_path: Option<&'a Path>,
    pub installed_path: &'a Path,
    pub expected_artifact_sha256: Option<&'a str>,
    pub expected_manifest_fingerprint: Option<&'a str>,
}

pub struct ArtifactReconcileResult {
    pub outcome: ArtifactReconcileOutcome,
    pub manifest_fingerprint: Option<String>,
    pub last_error: Option<String>,
}

pub fn compute_manifest_fingerprint(manifest_path: &Path) -> Result<String, PluginFrameworkError> {
    let bytes = std::fs::read(manifest_path)
        .map_err(|error| PluginFrameworkError::io(Some(manifest_path), error.to_string()))?;
    let digest = Sha256::digest(bytes);
    Ok(format!("sha256:{digest:x}"))
}

pub fn reconcile_provider_artifact(
    input: ArtifactReconcileInput<'_>,
) -> Result<ArtifactReconcileResult, PluginFrameworkError> {
    if !input.installed_path.is_dir() {
        return Ok(ArtifactReconcileResult {
            outcome: ArtifactReconcileOutcome::Missing,
            manifest_fingerprint: None,
            last_error: Some("installed_path_missing".into()),
        });
    }

    let manifest_path = input.installed_path.join("manifest.yaml");
    if !manifest_path.is_file() {
        return Ok(ArtifactReconcileResult {
            outcome: ArtifactReconcileOutcome::InstallIncomplete,
            manifest_fingerprint: None,
            last_error: Some("manifest_missing".into()),
        });
    }

    let manifest_fingerprint = compute_manifest_fingerprint(&manifest_path)?;
    if let Some(expected) = input.expected_manifest_fingerprint {
        if expected != manifest_fingerprint {
            return Ok(ArtifactReconcileResult {
                outcome: ArtifactReconcileOutcome::Corrupted,
                manifest_fingerprint: Some(manifest_fingerprint),
                last_error: Some("manifest_fingerprint_mismatch".into()),
            });
        }
    }

    if let Some(package_path) = input.package_path {
        if !package_path.is_file() {
            return Ok(ArtifactReconcileResult {
                outcome: ArtifactReconcileOutcome::InstallIncomplete,
                manifest_fingerprint: Some(manifest_fingerprint),
                last_error: Some("package_path_missing".into()),
            });
        }
    }

    Ok(ArtifactReconcileResult {
        outcome: ArtifactReconcileOutcome::Ready,
        manifest_fingerprint: Some(manifest_fingerprint),
        last_error: None,
    })
}
```

- [ ] **Step 4: Export the module and reuse the helper from package-loading code**

Wire `api/crates/plugin-framework/src/lib.rs`:

```rust
pub mod artifact_reconcile;

pub use artifact_reconcile::*;
```

And add a thin manifest helper in `api/crates/plugin-framework/src/provider_package.rs`:

```rust
impl ProviderPackage {
    pub fn manifest_path(&self) -> PathBuf {
        self.root.join("manifest.yaml")
    }
}
```

- [ ] **Step 5: Re-run `plugin-framework` reconcile tests**

Run:

```bash
cargo test --manifest-path api/Cargo.toml -p plugin-framework artifact_reconcile -- --nocapture
```

Expected:

- PASS with explicit outcomes for `missing`, `install_incomplete`, `ready`, and `corrupted`.

- [ ] **Step 6: Commit the reconcile helper**

Run:

```bash
git add api/crates/plugin-framework/src/lib.rs api/crates/plugin-framework/src/provider_package.rs api/crates/plugin-framework/src/artifact_reconcile.rs api/crates/plugin-framework/src/_tests/artifact_reconcile_tests.rs
git commit -m "feat: add plugin artifact reconcile helper"
```

### Task 3: Derive Availability In Control-Plane Reads And Writes

**Files:**
- Create: `api/crates/control-plane/src/plugin_lifecycle.rs`
- Modify: `api/crates/control-plane/src/lib.rs`
- Modify: `api/crates/control-plane/src/ports.rs`
- Modify: `api/crates/control-plane/src/plugin_management.rs`
- Modify: `api/crates/control-plane/src/model_provider.rs`
- Modify: `api/crates/control-plane/src/orchestration_runtime.rs`
- Test: `api/crates/control-plane/src/_tests/plugin_management_service_tests.rs`
- Test: `api/crates/control-plane/src/_tests/model_provider_service_tests.rs`
- Test: `api/crates/control-plane/src/_tests/orchestration_runtime_service_tests.rs`

- [ ] **Step 1: Write failing control-plane tests for derived availability and reconcile downgrade**

Add tests like these:

```rust
#[tokio::test]
async fn install_uploaded_plugin_persists_ready_artifact_and_disabled_availability() {
    let repository = MemoryPluginManagementRepository::new(actor_with_plugin_permissions());
    let runtime = RecordingRuntime::default();
    let service = PluginManagementService::new(
        repository.clone(),
        runtime,
        Arc::new(FakeOfficialSource::default()),
        temp_install_root(),
    );

    let result = service
        .install_uploaded_plugin(InstallUploadedPluginCommand {
            actor_user_id: repository.actor.user_id,
            file_name: "fixture_provider.1flowbasepkg".into(),
            package_bytes: build_uploaded_package("0.1.0"),
        })
        .await
        .unwrap();

    assert_eq!(result.installation.artifact_status, PluginArtifactStatus::Ready);
    assert_eq!(result.installation.desired_state, PluginDesiredState::Disabled);
    assert_eq!(
        result.installation.availability_status,
        PluginAvailabilityStatus::Disabled
    );
    assert_eq!(result.task.status, PluginTaskStatus::Succeeded);
}

#[tokio::test]
async fn model_provider_catalog_reconciles_missing_artifacts_before_returning_available_entries() {
    let repository = seeded_repository_with_available_installation().await;
    std::fs::remove_dir_all(repository.only_installation().await.installed_path).unwrap();

    let service = ModelProviderService::new(
        repository.clone(),
        RecordingRuntime::default(),
        "dev-provider-secret-master-key-unsafe",
    );

    let catalog = service
        .list_catalog(repository.actor.user_id, RequestedLocales::default())
        .await
        .unwrap();

    assert!(catalog.entries.is_empty());
    let installation = repository.only_installation().await;
    assert_eq!(installation.artifact_status, PluginArtifactStatus::Missing);
    assert_eq!(
        installation.availability_status,
        PluginAvailabilityStatus::ArtifactMissing
    );
}

#[tokio::test]
async fn orchestration_runtime_rejects_non_available_installation_after_reconcile() {
    let repository = seeded_orchestration_repository_with_ready_provider().await;
    std::fs::remove_dir_all(repository.only_installation().await.installed_path).unwrap();

    let runtime = build_orchestration_runtime(repository.clone()).await;
    let error = runtime
        .invoke_llm(&compiled_runtime("provider-instance-1"), sample_provider_input())
        .await
        .expect_err("missing artifacts must block invocation");

    assert!(error.to_string().contains("plugin_installation_unavailable"));
}
```

- [ ] **Step 2: Run control-plane tests to capture the RED baseline**

Run:

```bash
cargo test --manifest-path api/Cargo.toml -p control-plane plugin_management_service_tests -- --nocapture
cargo test --manifest-path api/Cargo.toml -p control-plane model_provider_service_tests -- --nocapture
cargo test --manifest-path api/Cargo.toml -p control-plane orchestration_runtime_service_tests -- --nocapture
```

Expected:

- FAIL because services still persist `enabled`, load from `install_path`, skip reconcile, and filter availability with a boolean.

- [ ] **Step 3: Implement a shared lifecycle derivation helper**

Create `api/crates/control-plane/src/plugin_lifecycle.rs` with:

```rust
use domain::{
    PluginArtifactStatus, PluginAvailabilityStatus, PluginDesiredState, PluginRuntimeStatus,
};

pub fn derive_availability_status(
    desired_state: PluginDesiredState,
    artifact_status: PluginArtifactStatus,
    runtime_status: PluginRuntimeStatus,
) -> PluginAvailabilityStatus {
    match desired_state {
        PluginDesiredState::Disabled => PluginAvailabilityStatus::Disabled,
        PluginDesiredState::PendingRestart => {
            if artifact_status == PluginArtifactStatus::Ready {
                PluginAvailabilityStatus::PendingRestart
            } else {
                PluginAvailabilityStatus::ArtifactMissing
            }
        }
        PluginDesiredState::ActiveRequested => match artifact_status {
            PluginArtifactStatus::Missing => PluginAvailabilityStatus::ArtifactMissing,
            PluginArtifactStatus::Staged
            | PluginArtifactStatus::InstallIncomplete
            | PluginArtifactStatus::Corrupted => PluginAvailabilityStatus::InstallIncomplete,
            PluginArtifactStatus::Ready => match runtime_status {
                PluginRuntimeStatus::Active => PluginAvailabilityStatus::Available,
                PluginRuntimeStatus::LoadFailed => PluginAvailabilityStatus::LoadFailed,
                PluginRuntimeStatus::Inactive => PluginAvailabilityStatus::InstallIncomplete,
            },
        },
    }
}
```

- [ ] **Step 4: Rework install, enable, list, and invoke paths to reconcile before load and to write only owned lifecycle fields**

Update the write path in `api/crates/control-plane/src/plugin_management.rs`:

```rust
let package_archive_path = self
    .install_root
    .join("packages")
    .join(&installed_package.manifest.plugin_code)
    .join(format!("{}.1flowbasepkg", installed_package.identifier()));
let installed_path = self
    .install_root
    .join("installed")
    .join(&installed_package.manifest.plugin_code)
    .join(&installed_package.manifest.version);

std::fs::create_dir_all(package_archive_path.parent().unwrap())?;
std::fs::write(&package_archive_path, &command.package_bytes)?;
copy_installation_artifact(&intake.extracted_root, &installed_path)?;

let manifest_fingerprint =
    compute_manifest_fingerprint(&installed_path.join("manifest.yaml"))?;

let availability_status = derive_availability_status(
    PluginDesiredState::Disabled,
    PluginArtifactStatus::Ready,
    PluginRuntimeStatus::Inactive,
);

self.repository
    .upsert_installation(&UpsertPluginInstallationInput {
        installation_id,
        provider_code: installed_package.provider.provider_code.clone(),
        plugin_id: installed_package.identifier(),
        plugin_version: installed_package.manifest.version.clone(),
        contract_version: installed_package.manifest.contract_version.clone(),
        protocol: installed_package.provider.protocol.clone(),
        display_name: installed_package.provider.display_name.clone(),
        source_kind: intake.source_kind,
        trust_level: intake.trust_level,
        verification_status: domain::PluginVerificationStatus::Valid,
        desired_state: PluginDesiredState::Disabled,
        artifact_status: PluginArtifactStatus::Ready,
        runtime_status: PluginRuntimeStatus::Inactive,
        availability_status,
        package_path: Some(package_archive_path.display().to_string()),
        installed_path: installed_path.display().to_string(),
        checksum: intake.checksum,
        manifest_fingerprint: Some(manifest_fingerprint),
        signature_status: Some(intake.signature_status),
        signature_algorithm: intake.signature_algorithm,
        signing_key_id: intake.signing_key_id,
        last_load_error: None,
        metadata_json: json!({}),
        actor_user_id: command.actor_user_id,
    })
    .await?;
```

Update critical-load consumers in `model_provider.rs` and `orchestration_runtime.rs`:

```rust
let installation = self
    .reconcile_installation_snapshot(instance.installation_id)
    .await?;
if installation.availability_status != domain::PluginAvailabilityStatus::Available {
    return Err(ControlPlaneError::Conflict("plugin_installation_unavailable").into());
}

let package = load_provider_package(&installation.installed_path)?;
```

And map the old enable path to desired state instead of a boolean:

```rust
let desired_state = domain::PluginDesiredState::ActiveRequested;
let runtime_status = match self.runtime.ensure_loaded(&installation).await {
    Ok(()) => domain::PluginRuntimeStatus::Active,
    Err(error) => {
        self.repository
            .update_runtime_snapshot(&UpdatePluginRuntimeSnapshotInput {
                installation_id: installation.id,
                runtime_status: domain::PluginRuntimeStatus::LoadFailed,
                availability_status: derive_availability_status(
                    desired_state,
                    installation.artifact_status,
                    domain::PluginRuntimeStatus::LoadFailed,
                ),
                last_load_error: Some(error.to_string()),
            })
            .await?;
        return Err(error);
    }
};
```

- [ ] **Step 5: Re-run control-plane tests**

Run:

```bash
cargo test --manifest-path api/Cargo.toml -p control-plane plugin_management_service_tests -- --nocapture
cargo test --manifest-path api/Cargo.toml -p control-plane model_provider_service_tests -- --nocapture
cargo test --manifest-path api/Cargo.toml -p control-plane orchestration_runtime_service_tests -- --nocapture
```

Expected:

- PASS with `availability_status` derived from the three owned layers and stale artifacts downgraded before load.

- [ ] **Step 6: Commit the control-plane lifecycle rewrite**

Run:

```bash
git add api/crates/control-plane/src/lib.rs api/crates/control-plane/src/ports.rs api/crates/control-plane/src/plugin_lifecycle.rs api/crates/control-plane/src/plugin_management.rs api/crates/control-plane/src/model_provider.rs api/crates/control-plane/src/orchestration_runtime.rs api/crates/control-plane/src/_tests/plugin_management_service_tests.rs api/crates/control-plane/src/_tests/model_provider_service_tests.rs api/crates/control-plane/src/_tests/orchestration_runtime_service_tests.rs
git commit -m "feat: derive plugin availability in control plane"
```

### Task 4: Expose Lifecycle Status Through API Startup And Settings UI

**Files:**
- Modify: `api/apps/api-server/src/lib.rs`
- Modify: `api/apps/api-server/src/provider_runtime.rs`
- Modify: `api/apps/api-server/src/routes/plugins.rs`
- Modify: `api/apps/api-server/src/routes/model_providers.rs`
- Modify: `api/apps/api-server/src/openapi.rs`
- Modify: `api/apps/api-server/src/_tests/plugin_routes.rs`
- Modify: `api/apps/api-server/src/_tests/model_provider_routes.rs`
- Modify: `web/packages/api-client/src/console-plugins.ts`
- Modify: `web/packages/api-client/src/console-model-providers.ts`
- Modify: `web/app/src/features/settings/api/plugins.ts`
- Modify: `web/app/src/features/settings/api/model-providers.ts`
- Modify: `web/app/src/features/settings/pages/SettingsPage.tsx`
- Create: `web/app/src/features/settings/components/model-providers/plugin-installation-status.ts`
- Modify: `web/app/src/features/settings/components/model-providers/ModelProviderCatalogPanel.tsx`
- Modify: `web/app/src/features/settings/components/model-providers/OfficialPluginInstallPanel.tsx`
- Modify: `web/app/src/features/settings/components/model-providers/PluginUploadInstallModal.tsx`
- Modify: `web/app/src/features/settings/components/model-providers/PluginVersionManagementModal.tsx`
- Test: `web/app/src/features/settings/_tests/model-providers-page.test.tsx`

- [ ] **Step 1: Write failing route and page tests for lifecycle fields and status tags**

Add tests like these:

```rust
#[tokio::test]
async fn install_uploaded_plugin_returns_lifecycle_fields_without_host_paths() {
    let app = test_app().await;
    let (cookie, csrf) = login_and_capture_cookie(&app).await;

    let response = app
        .oneshot(upload_plugin_request(cookie.as_str(), csrf.as_str(), build_signed_openai_upload_package("0.2.0")))
        .await
        .unwrap();

    let payload = response_json(response).await;

    assert_eq!(payload["data"]["installation"]["desired_state"], "disabled");
    assert_eq!(payload["data"]["installation"]["artifact_status"], "ready");
    assert_eq!(payload["data"]["installation"]["runtime_status"], "inactive");
    assert_eq!(payload["data"]["installation"]["availability_status"], "disabled");
    assert!(payload["data"]["installation"].get("install_path").is_none());
}
```

```tsx
test('renders pending restart and load failed lifecycle tags instead of enabled labels', async () => {
  modelProvidersApi.fetchSettingsModelProviderCatalog.mockResolvedValue([
    {
      ...modelProviderCatalogEntries[0],
      desired_state: 'pending_restart',
      availability_status: 'pending_restart'
    }
  ]);

  pluginsApi.fetchSettingsPluginFamilies.mockResolvedValue([
    {
      provider_code: 'openai_compatible',
      plugin_type: 'model_provider',
      namespace: 'plugin.openai_compatible',
      label_key: 'plugin.label',
      description_key: 'plugin.description',
      provider_label_key: 'provider.label',
      protocol: 'openai_compatible',
      help_url: 'https://platform.openai.com/docs/api-reference',
      default_base_url: 'https://api.openai.com/v1',
      model_discovery_mode: 'hybrid',
      current_installation_id: 'installation-1',
      current_version: '0.2.0',
      latest_version: '0.2.0',
      has_update: false,
      installed_versions: []
    }
  ]);

  renderApp('/settings/model-providers');

  expect(await screen.findByText('待重启')).toBeInTheDocument();
  expect(screen.queryByText('已启用')).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Run API route tests and settings-page tests to capture RED**

Run:

```bash
cargo test --manifest-path api/Cargo.toml -p api-server plugin_routes -- --nocapture
cargo test --manifest-path api/Cargo.toml -p api-server model_provider_routes -- --nocapture
pnpm --dir web/app exec vitest run src/features/settings/_tests/model-providers-page.test.tsx
```

Expected:

- FAIL because API DTOs still expose `enabled` / `install_path`, startup does not reconcile stale installations, and the settings page still renders `已启用`.

- [ ] **Step 3: Reconcile installations on startup and expose lifecycle DTOs through API routes**

In `api/apps/api-server/src/lib.rs`, call a system reconcile before serving routes:

```rust
let provider_runtime = Arc::new(RwLock::new(plugin_runner::provider_host::ProviderHost::default()));
let official_plugin_source = Arc::new(
    official_plugin_registry::ApiOfficialPluginRegistry::new(
        resolved_official_source,
        trusted_public_keys,
    ),
);

PluginManagementService::new(
    store.clone(),
    ApiProviderRuntime::new(provider_runtime.clone()),
    official_plugin_source.clone(),
    config.provider_install_root.clone(),
)
.reconcile_all_installations()
.await?;
```

Update `api/apps/api-server/src/provider_runtime.rs` so runtime load paths use the renamed storage field:

```rust
async fn ensure_loaded(
    &self,
    installation: &domain::PluginInstallationRecord,
) -> anyhow::Result<()> {
    let mut host = self.host.write().await;
    match host.reload(&installation.plugin_id) {
        Ok(_) => Ok(()),
        Err(_) => host
            .load(&installation.installed_path)
            .map(|_| ())
            .map_err(map_framework_error),
    }
}
```

Update `api/apps/api-server/src/routes/plugins.rs` and `routes/model_providers.rs` to expose lifecycle fields instead of booleans:

```rust
pub struct PluginInstallationResponse {
    pub id: String,
    pub provider_code: String,
    pub plugin_id: String,
    pub plugin_version: String,
    pub contract_version: String,
    pub protocol: String,
    pub display_name: String,
    pub source_kind: String,
    pub trust_level: String,
    pub verification_status: String,
    pub desired_state: String,
    pub artifact_status: String,
    pub runtime_status: String,
    pub availability_status: String,
    pub checksum: Option<String>,
    pub signature_status: Option<String>,
    pub signature_algorithm: Option<String>,
    pub signing_key_id: Option<String>,
    pub last_load_error: Option<String>,
    pub metadata_json: serde_json::Value,
    pub created_at: String,
    pub updated_at: String,
}

pub struct ModelProviderCatalogEntryResponse {
    pub installation_id: String,
    pub provider_code: String,
    pub plugin_id: String,
    pub plugin_version: String,
    pub plugin_type: String,
    pub namespace: String,
    pub label_key: String,
    pub description_key: Option<String>,
    pub display_name: String,
    pub protocol: String,
    pub help_url: Option<String>,
    pub default_base_url: Option<String>,
    pub model_discovery_mode: String,
    pub supports_model_fetch_without_credentials: bool,
    pub desired_state: String,
    pub availability_status: String,
    pub form_schema: Vec<ModelProviderConfigFieldResponse>,
    pub predefined_models: Vec<ProviderModelDescriptorResponse>,
}
```

- [ ] **Step 4: Update browser DTOs and render lifecycle labels through a shared formatter**

Create `web/app/src/features/settings/components/model-providers/plugin-installation-status.ts`:

```ts
export function formatPluginAvailabilityStatus(status: string) {
  switch (status) {
    case 'available':
      return { color: 'green', label: '可用' };
    case 'pending_restart':
      return { color: 'gold', label: '待重启' };
    case 'load_failed':
      return { color: 'red', label: '加载失败' };
    case 'artifact_missing':
      return { color: 'red', label: '产物缺失' };
    case 'install_incomplete':
      return { color: 'orange', label: '安装不完整' };
    default:
      return { color: 'default', label: '已禁用' };
  }
}
```

Update API clients:

```ts
export interface ConsolePluginInstallation {
  id: string;
  provider_code: string;
  plugin_id: string;
  plugin_version: string;
  contract_version: string;
  protocol: string;
  display_name: string;
  source_kind: string;
  trust_level: string;
  verification_status: string;
  desired_state: string;
  artifact_status: string;
  runtime_status: string;
  availability_status: string;
  checksum: string | null;
  signature_status: string | null;
  signature_algorithm: string | null;
  signing_key_id: string | null;
  last_load_error: string | null;
  metadata_json: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}
```

Use the helper in settings components so:

- `ModelProviderCatalogPanel` shows `可用 / 待重启 / 加载失败 / 安装不完整`
- `PluginUploadInstallModal` success summary shows both trust and availability
- `PluginVersionManagementModal` shows lifecycle state beside each installed version
- `OfficialPluginInstallPanel` keeps source/trust labels but no longer implies “assigned == enabled”

- [ ] **Step 5: Re-run route tests and settings-page tests**

Run:

```bash
cargo test --manifest-path api/Cargo.toml -p api-server plugin_routes -- --nocapture
cargo test --manifest-path api/Cargo.toml -p api-server model_provider_routes -- --nocapture
pnpm --dir web/app exec vitest run src/features/settings/_tests/model-providers-page.test.tsx
```

Expected:

- PASS with lifecycle DTOs in API responses, startup reconcile in place, and the settings page rendering derived availability labels instead of `enabled`.

- [ ] **Step 6: Commit the API and UI lifecycle surface**

Run:

```bash
git add api/apps/api-server/src/lib.rs api/apps/api-server/src/provider_runtime.rs api/apps/api-server/src/routes/plugins.rs api/apps/api-server/src/routes/model_providers.rs api/apps/api-server/src/openapi.rs api/apps/api-server/src/_tests/plugin_routes.rs api/apps/api-server/src/_tests/model_provider_routes.rs web/packages/api-client/src/console-plugins.ts web/packages/api-client/src/console-model-providers.ts web/app/src/features/settings/api/plugins.ts web/app/src/features/settings/api/model-providers.ts web/app/src/features/settings/pages/SettingsPage.tsx web/app/src/features/settings/components/model-providers/plugin-installation-status.ts web/app/src/features/settings/components/model-providers/ModelProviderCatalogPanel.tsx web/app/src/features/settings/components/model-providers/OfficialPluginInstallPanel.tsx web/app/src/features/settings/components/model-providers/PluginUploadInstallModal.tsx web/app/src/features/settings/components/model-providers/PluginVersionManagementModal.tsx web/app/src/features/settings/_tests/model-providers-page.test.tsx
git commit -m "feat: expose plugin lifecycle through settings"
```

## Self-Review

- Spec coverage: this plan covers the finalized lifecycle layers, derived availability, startup plus critical-load reconcile, uploaded install backfill behavior, and current `/settings/model-providers` browser consumption. It intentionally does not attempt to implement generic node contribution execution or host-extension runtime loading in the same round.
- Placeholder scan: no `TODO`, `TBD`, or unnamed files remain. Every task names concrete files, concrete tests, concrete commands, and the code shapes expected in each step.
- Type consistency: the plan consistently uses `PluginDesiredState`, `PluginArtifactStatus`, `PluginRuntimeStatus`, `PluginAvailabilityStatus`, `queued`, and `succeeded`; later tasks reuse the same names and do not fall back to `enabled` / `install_path`.
