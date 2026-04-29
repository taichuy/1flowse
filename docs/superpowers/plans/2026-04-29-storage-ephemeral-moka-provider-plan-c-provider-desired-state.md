# Storage Ephemeral Moka Provider Plan C Provider Desired State Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make installed HostExtension infrastructure provider configuration editable before runtime activation and save config plus enablement as one restart-scoped desired state.

**Architecture:** Extend `host-extension.yaml` infrastructure provider declarations with form metadata. A provider may appear once per contract in `host-extension.yaml`, so the config service groups entries by `(installation_id, provider_code, config_ref)` and returns one configurable provider row with a `contracts` list. Saving config plus enabled contracts writes durable desired state and never swaps the active provider inside the running process.

**Tech Stack:** Rust, plugin-framework manifest parser, control-plane service, storage-durable PostgreSQL migration/repository, Axum routes, api-client DTOs, targeted Cargo tests.

---

## File Structure

**Create**
- `api/crates/control-plane/src/host_infrastructure_config.rs`: service for provider listing, config validation, grouping, and pending restart desired state.
- `api/crates/control-plane/src/_tests/host_infrastructure_config_tests.rs`: service tests for installed-manifest config, grouping, disabled inactive listing, and one-restart semantics.
- `api/crates/storage-durable/postgres/migrations/20260429133000_create_host_infrastructure_provider_configs.sql`: durable desired provider config table.
- `api/crates/storage-durable/postgres/src/host_infrastructure_config_repository.rs`: PostgreSQL repository implementation.
- `api/crates/storage-durable/postgres/src/_tests/host_infrastructure_config_repository_tests.rs`: repository tests.
- `api/apps/api-server/src/routes/settings/host_infrastructure.rs`: console API routes.
- `api/apps/api-server/src/_tests/host_infrastructure_config_routes.rs`: route tests.

**Modify**
- `api/crates/plugin-framework/src/host_extension_contribution.rs`: add provider `display_name`, `description`, `config_schema`; remove `Eq` derives from types that contain `PluginFormFieldSchema`.
- `api/crates/plugin-framework/src/host_extension_registry.rs`: remove `Eq` derive from `RegisteredHostExtension`; keep `RegisteredInfrastructureProvider` storing only identity fields.
- `api/crates/plugin-framework/src/_tests/host_extension_contribution_tests.rs`: assert provider config schema parsing.
- `api/crates/plugin-framework/src/_tests/host_extension_registry_tests.rs`: update provider fixture builder with display/config fields.
- `api/plugins/host-extensions/*/host-extension.yaml`: add `display_name`, `description`, and `config_schema: []` to existing infrastructure provider entries.
- `api/crates/control-plane/src/lib.rs`: export `host_infrastructure_config`.
- `api/crates/control-plane/src/ports/plugin.rs`: add repository trait/input structs for host infrastructure provider configs.
- `api/crates/domain/src/host_extension.rs`: add host infrastructure provider config record/status types.
- `api/crates/domain/src/lib.rs`: export new domain types.
- `api/crates/storage-durable/postgres/src/lib.rs`: include repository module.
- `api/crates/storage-durable/postgres/src/_tests/mod.rs`: include repository tests.
- `api/apps/api-server/src/routes/settings/mod.rs`: export `host_infrastructure`.
- `api/apps/api-server/src/routes/mod.rs`: re-export `host_infrastructure`.
- `api/apps/api-server/src/lib.rs`: nest `routes::host_infrastructure::router()` under `/api/console`.
- `api/apps/api-server/src/openapi.rs`: include route schemas if the local OpenAPI registry requires explicit registration.
- `web/packages/api-client/src/console-plugins.ts`: add types and functions consumed by Plan D.
- `web/packages/api-client/src/index.ts`: export new functions if not automatically exported.

### Task 1: Add HostExtension Provider Config Schema Parsing

**Files:**
- Modify: `api/crates/plugin-framework/src/host_extension_contribution.rs`
- Modify: `api/crates/plugin-framework/src/host_extension_registry.rs`
- Modify: `api/crates/plugin-framework/src/_tests/host_extension_contribution_tests.rs`
- Modify: `api/crates/plugin-framework/src/_tests/host_extension_registry_tests.rs`
- Modify: `api/plugins/host-extensions/*/host-extension.yaml`

 **Step 1: Write RED parser tests**

Add:

```rust
#[test]
fn parses_infrastructure_provider_config_schema_before_runtime_activation() {
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
    display_name: Redis
    description: Redis backed host infrastructure.
    config_ref: secret://system/redis-infra-host/config
    config_schema:
      - key: host
        label: Host
        type: string
        required: true
      - key: port
        label: Port
        type: number
        required: true
        default_value: 6379
      - key: password_ref
        label: Password Secret Ref
        type: string
        send_mode: secret_ref
  - contract: cache-store
    provider_code: redis
    display_name: Redis
    description: Redis backed host infrastructure.
    config_ref: secret://system/redis-infra-host/config
    config_schema:
      - key: host
        label: Host
        type: string
        required: true
routes: []
workers: []
migrations: []
"#;

    let manifest = parse_host_extension_contribution_manifest(raw).unwrap();
    assert_eq!(manifest.infrastructure_providers.len(), 2);
    let provider = &manifest.infrastructure_providers[0];

    assert_eq!(provider.contract, "storage-ephemeral");
    assert_eq!(provider.provider_code, "redis");
    assert_eq!(provider.display_name, "Redis");
    assert_eq!(provider.config_schema[0].key, "host");
    assert_eq!(provider.config_schema[2].send_mode.as_deref(), Some("secret_ref"));
}
```

 **Step 2: Run RED verification**

Run:

```bash
cd api
cargo test -p plugin-framework host_extension_contribution -- --nocapture
```

Expected: FAIL because `config_schema`, `display_name`, and `description` are not in `HostInfrastructureProviderManifest`.

 **Step 3: Implement parser fields and derive fixes**

Update `HostInfrastructureProviderManifest`:

```rust
use crate::provider_contract::PluginFormFieldSchema;

#[derive(Debug, Clone, PartialEq, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct HostInfrastructureProviderManifest {
    pub contract: String,
    pub provider_code: String,
    pub display_name: String,
    #[serde(default)]
    pub description: Option<String>,
    pub config_ref: String,
    #[serde(default)]
    pub config_schema: Vec<PluginFormFieldSchema>,
}
```

Remove `Eq` from `HostInfrastructureProviderManifest`, `HostExtensionContributionManifest`, and `RegisteredHostExtension` because `PluginFormFieldSchema` only derives `PartialEq`.

Add validation:

```rust
validate_non_empty(&provider.display_name, "infrastructure_providers[].display_name")?;
for field in &provider.config_schema {
    validate_non_empty(&field.key, "infrastructure_providers[].config_schema[].key")?;
    validate_non_empty(&field.label, "infrastructure_providers[].config_schema[].label")?;
    validate_non_empty(&field.field_type, "infrastructure_providers[].config_schema[].type")?;
}
```

Update `api/crates/plugin-framework/src/_tests/host_extension_registry_tests.rs` helper:

```rust
fn infrastructure_provider(
    contract: &str,
    provider_code: &str,
) -> HostInfrastructureProviderManifest {
    HostInfrastructureProviderManifest {
        contract: contract.into(),
        provider_code: provider_code.into(),
        display_name: provider_code.to_string(),
        description: None,
        config_ref: format!("secret://system/{provider_code}/config"),
        config_schema: vec![],
    }
}
```

 **Step 4: Update existing host extension manifests**

For every entry under `api/plugins/host-extensions/*/host-extension.yaml`, add:

```yaml
    display_name: Local
    description: Local in-process host infrastructure provider.
    config_schema: []
```

Use provider-specific display text where the provider is not `local`, for example `Plugin Host`, `Identity Host`, or `File Management Host`.

 **Step 5: Re-run parser and registry tests**

Run:

```bash
cd api
cargo test -p plugin-framework host_extension_contribution -- --nocapture
cargo test -p plugin-framework host_extension_registry -- --nocapture
```

Expected: PASS.

### Task 2: Add Durable Desired Config Repository

**Files:**
- Modify: `api/crates/domain/src/host_extension.rs`
- Modify: `api/crates/domain/src/lib.rs`
- Modify: `api/crates/control-plane/src/ports/plugin.rs`
- Create: `api/crates/storage-durable/postgres/migrations/20260429133000_create_host_infrastructure_provider_configs.sql`
- Create: `api/crates/storage-durable/postgres/src/host_infrastructure_config_repository.rs`
- Modify: `api/crates/storage-durable/postgres/src/lib.rs`
- Create: `api/crates/storage-durable/postgres/src/_tests/host_infrastructure_config_repository_tests.rs`
- Modify: `api/crates/storage-durable/postgres/src/_tests/mod.rs`

 **Step 1: Add domain and port types**

Add to `domain/src/host_extension.rs`:

```rust
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum HostInfrastructureConfigStatus {
    Disabled,
    PendingRestart,
    Active,
}

impl HostInfrastructureConfigStatus {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Disabled => "disabled",
            Self::PendingRestart => "pending_restart",
            Self::Active => "active",
        }
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct HostInfrastructureProviderConfigRecord {
    pub id: uuid::Uuid,
    pub installation_id: uuid::Uuid,
    pub extension_id: String,
    pub provider_code: String,
    pub config_ref: String,
    pub enabled_contracts: Vec<String>,
    pub config_json: serde_json::Value,
    pub status: HostInfrastructureConfigStatus,
    pub updated_by: uuid::Uuid,
    pub created_at: time::OffsetDateTime,
    pub updated_at: time::OffsetDateTime,
}
```

Add to `control-plane/src/ports/plugin.rs`:

```rust
#[derive(Debug, Clone)]
pub struct UpsertHostInfrastructureProviderConfigInput {
    pub installation_id: Uuid,
    pub extension_id: String,
    pub provider_code: String,
    pub config_ref: String,
    pub enabled_contracts: Vec<String>,
    pub config_json: serde_json::Value,
    pub status: domain::HostInfrastructureConfigStatus,
    pub actor_user_id: Uuid,
}

#[async_trait]
pub trait HostInfrastructureConfigRepository: Send + Sync {
    async fn upsert_host_infrastructure_provider_config(
        &self,
        input: &UpsertHostInfrastructureProviderConfigInput,
    ) -> anyhow::Result<domain::HostInfrastructureProviderConfigRecord>;

    async fn list_host_infrastructure_provider_configs(
        &self,
    ) -> anyhow::Result<Vec<domain::HostInfrastructureProviderConfigRecord>>;
}
```

 **Step 2: Add migration**

Create:

```sql
create table host_infrastructure_provider_configs (
    id uuid primary key,
    installation_id uuid not null references plugin_installations(id) on delete cascade,
    extension_id text not null,
    provider_code text not null,
    config_ref text not null,
    enabled_contracts text[] not null default '{}',
    config_json jsonb not null default '{}'::jsonb,
    status text not null,
    updated_by uuid not null references users(id) on delete restrict,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint host_infra_provider_configs_status_check
        check (status in ('disabled', 'pending_restart', 'active')),
    constraint host_infra_provider_configs_config_ref_check
        check (config_ref like 'secret://system/%'),
    constraint host_infra_provider_configs_unique_provider
        unique (installation_id, provider_code)
);

create index host_infra_provider_configs_contracts_idx
    on host_infrastructure_provider_configs using gin (enabled_contracts);
```

 **Step 3: Add repository test**

Add a test that creates one host extension installation and upserts `provider_code = redis` with `enabled_contracts = ['storage-ephemeral', 'cache-store']`. Assert the returned record has `status = PendingRestart`, then list all configs and assert exactly one record exists for Redis.

 **Step 4: Implement repository and run tests**

Run:

```bash
cd api
cargo test -p storage-postgres host_infrastructure_config_repository -- --nocapture
```

Expected: PASS.

### Task 3: Add Control-Plane Config Service

**Files:**
- Create: `api/crates/control-plane/src/host_infrastructure_config.rs`
- Modify: `api/crates/control-plane/src/lib.rs`
- Create: `api/crates/control-plane/src/_tests/host_infrastructure_config_tests.rs`
- Modify: `api/crates/control-plane/src/_tests/mod.rs`

 **Step 1: Write service tests**

Add tests:

```rust
#[tokio::test]
async fn lists_disabled_installed_provider_config_schema_while_runtime_inactive() {
    let repository = FakeRepository::with_host_extension_installation(
        "redis-infra-host",
        domain::PluginDesiredState::Disabled,
        domain::PluginRuntimeStatus::Inactive,
        fixture_installed_path("redis-infra-host"),
    );
    let service = HostInfrastructureConfigService::new(repository);

    let view = service
        .list_providers(actor_with_permissions(&["plugin_config.view.all"]))
        .await
        .unwrap();

    assert_eq!(view.providers.len(), 1);
    assert_eq!(view.providers[0].extension_id, "redis-infra-host");
    assert_eq!(view.providers[0].provider_code, "redis");
    assert_eq!(view.providers[0].runtime_status, "inactive");
    assert_eq!(view.providers[0].desired_state, "disabled");
    assert_eq!(view.providers[0].config_schema[0].key, "host");
}

#[tokio::test]
async fn groups_multiple_contract_entries_into_one_provider_view() {
    let repository = FakeRepository::with_host_extension_installation(
        "redis-infra-host",
        domain::PluginDesiredState::Disabled,
        domain::PluginRuntimeStatus::Inactive,
        fixture_installed_path("redis-infra-host"),
    );
    let service = HostInfrastructureConfigService::new(repository);

    let view = service
        .list_providers(actor_with_permissions(&["plugin_config.view.all"]))
        .await
        .unwrap();

    assert_eq!(view.providers.len(), 1);
    assert_eq!(
        view.providers[0].contracts,
        vec!["storage-ephemeral".to_string(), "cache-store".to_string()]
    );
}

#[tokio::test]
async fn save_config_and_enable_contracts_writes_one_pending_restart_change() {
    let repository = FakeRepository::with_host_extension_installation(
        "redis-infra-host",
        domain::PluginDesiredState::Disabled,
        domain::PluginRuntimeStatus::Inactive,
        fixture_installed_path("redis-infra-host"),
    );
    let service = HostInfrastructureConfigService::new(repository.clone());

    let result = service
        .save_provider_config(SaveHostInfrastructureProviderConfigCommand {
            actor_user_id: root_user_id(),
            installation_id: redis_installation_id(),
            provider_code: "redis".to_string(),
            enabled_contracts: vec!["storage-ephemeral".to_string(), "cache-store".to_string()],
            config_json: serde_json::json!({
                "host": "localhost",
                "port": 6379,
                "password_ref": "env://REDIS_PASSWORD"
            }),
        })
        .await
        .unwrap();

    assert!(result.restart_required);
    assert_eq!(result.installation_desired_state, "pending_restart");
    assert_eq!(result.provider_config_status, "pending_restart");
    assert_eq!(
        repository.installation(redis_installation_id()).runtime_status,
        domain::PluginRuntimeStatus::Inactive
    );
}

#[tokio::test]
async fn save_rejects_enabled_contract_not_declared_by_provider() {
    let repository = FakeRepository::with_host_extension_installation(
        "redis-infra-host",
        domain::PluginDesiredState::Disabled,
        domain::PluginRuntimeStatus::Inactive,
        fixture_installed_path("redis-infra-host"),
    );
    let service = HostInfrastructureConfigService::new(repository);

    let error = service
        .save_provider_config(SaveHostInfrastructureProviderConfigCommand {
            actor_user_id: root_user_id(),
            installation_id: redis_installation_id(),
            provider_code: "redis".to_string(),
            enabled_contracts: vec!["task-queue".to_string()],
            config_json: serde_json::json!({
                "host": "localhost",
                "port": 6379
            }),
        })
        .await
        .unwrap_err();

    assert!(format!("{error:#}").contains("enabled_contract_not_declared"));
}
```

The fixture `host-extension.yaml` must include two Redis provider entries with the same `provider_code` and `config_ref`: `storage-ephemeral` and `cache-store`.

 **Step 2: Implement service DTOs**

Create:

```rust
pub struct HostInfrastructureConfigService<R> {
    repository: R,
}

#[derive(Debug, Clone, PartialEq)]
pub struct HostInfrastructureProviderConfigView {
    pub installation_id: uuid::Uuid,
    pub extension_id: String,
    pub provider_code: String,
    pub display_name: String,
    pub description: Option<String>,
    pub runtime_status: String,
    pub desired_state: String,
    pub config_ref: String,
    pub contracts: Vec<String>,
    pub enabled_contracts: Vec<String>,
    pub config_schema: Vec<plugin_framework::provider_contract::PluginFormFieldSchema>,
    pub config_json: serde_json::Value,
    pub restart_required: bool,
}

#[derive(Debug, Clone, PartialEq)]
pub struct HostInfrastructureProviderConfigList {
    pub providers: Vec<HostInfrastructureProviderConfigView>,
}

pub struct SaveHostInfrastructureProviderConfigCommand {
    pub actor_user_id: uuid::Uuid,
    pub installation_id: uuid::Uuid,
    pub provider_code: String,
    pub enabled_contracts: Vec<String>,
    pub config_json: serde_json::Value,
}

#[derive(Debug, Clone, PartialEq)]
pub struct SaveHostInfrastructureProviderConfigResult {
    pub restart_required: bool,
    pub installation_desired_state: String,
    pub provider_config_status: String,
}
```

Repository bound:

```rust
R: AuthRepository + PluginRepository + HostInfrastructureConfigRepository
```

Service rules:

```text
list_providers requires plugin_config.view.all.
save_provider_config requires plugin_config.configure.all.
load installed manifest.yaml and manifest.runtime.entry from installation.installed_path.
reject non-host-extension installations.
parse host-extension.yaml from installed files, not active runtime state.
group infrastructure_providers by (installation_id, provider_code, config_ref).
within one group, display_name, description, and config_schema must match; otherwise reject manifest as inconsistent_provider_config_schema.
return one view per provider group with contracts sorted by declaration order and duplicates removed.
merge durable saved config by (installation_id, provider_code) when present.
reject provider_code not declared in host-extension.yaml.
reject enabled_contracts not declared by the grouped provider.
reject missing required config_schema fields.
set plugin installation desired_state to PendingRestart and availability_status to PendingRestart.
upsert host infrastructure provider config with status PendingRestart.
return restart_required true.
do not update runtime_status to Active.
do not mutate HostInfrastructureRegistry or active provider trait objects.
```

 **Step 3: Run service tests**

Run:

```bash
cd api
cargo test -p control-plane host_infrastructure_config -- --nocapture
```

Expected: PASS.

### Task 4: Add Console API Routes

**Files:**
- Create: `api/apps/api-server/src/routes/settings/host_infrastructure.rs`
- Modify: `api/apps/api-server/src/routes/settings/mod.rs`
- Modify: `api/apps/api-server/src/routes/mod.rs`
- Modify: `api/apps/api-server/src/lib.rs`
- Create: `api/apps/api-server/src/_tests/host_infrastructure_config_routes.rs`
- Modify: `api/apps/api-server/src/_tests/mod.rs`

 **Step 1: Add route tests**

Add tests for:

```text
GET /api/console/settings/host-infrastructure/providers returns installed provider config schema when runtime_status is inactive and desired_state is disabled.
GET groups multiple Redis contract entries into one provider row.
PUT /api/console/settings/host-infrastructure/providers/{installation_id}/{provider_code}/config returns restart_required=true.
PUT rejects missing CSRF token.
PUT rejects enabled_contracts not declared by provider.
PUT does not return runtime_status=active and does not activate provider in-process.
```

Use a fixture installed host extension with `manifest.yaml` and `host-extension.yaml` in a temp directory. The fixture `host-extension.yaml` must include `config_schema` fields `host`, `port`, and `password_ref`.

 **Step 2: Add route module**

Expose:

```rust
pub fn router() -> Router<Arc<ApiState>> {
    Router::new()
        .route(
            "/settings/host-infrastructure/providers",
            get(list_host_infrastructure_providers),
        )
        .route(
            "/settings/host-infrastructure/providers/:installation_id/:provider_code/config",
            put(save_host_infrastructure_provider_config),
        )
}
```

Response body:

```rust
pub struct HostInfrastructureProviderConfigResponse {
    pub installation_id: String,
    pub extension_id: String,
    pub provider_code: String,
    pub display_name: String,
    pub description: Option<String>,
    pub runtime_status: String,
    pub desired_state: String,
    pub config_ref: String,
    pub contracts: Vec<String>,
    pub enabled_contracts: Vec<String>,
    pub config_schema: Vec<PluginFormFieldSchemaResponse>,
    pub config_json: serde_json::Value,
    pub restart_required: bool,
}

pub struct SaveHostInfrastructureProviderConfigBody {
    pub enabled_contracts: Vec<String>,
    pub config_json: serde_json::Value,
}

pub struct SaveHostInfrastructureProviderConfigResponse {
    pub restart_required: bool,
    pub installation_desired_state: String,
    pub provider_config_status: String,
}
```

Reuse the existing `PluginFormFieldSchemaResponse` mapping from `routes/plugins_and_models/model_providers.rs`; if it is private, move the schema response DTO and mapper into a shared route helper module instead of returning raw `PluginFormFieldSchema`.

 **Step 3: Export and mount route**

Update `api/apps/api-server/src/routes/settings/mod.rs`:

```rust
pub mod host_infrastructure;
```

Update `api/apps/api-server/src/routes/mod.rs`:

```rust
pub use settings_group::{
    docs, file_storages, file_tables, host_infrastructure, members, permissions, roles, system,
    workspace, workspaces,
};
```

Update `api/apps/api-server/src/lib.rs` inside `console_router`:

```rust
.nest("/api/console", routes::host_infrastructure::router())
```

 **Step 4: Run route tests**

Run:

```bash
cd api
cargo test -p api-server host_infrastructure_config_routes -- --nocapture
```

Expected: PASS.

### Task 5: Add Api Client Functions

**Files:**
- Modify: `web/packages/api-client/src/console-plugins.ts`
- Modify: `web/packages/api-client/src/index.ts`
- Modify: `web/app/src/features/settings/api/_tests/settings-api.test.ts`

 **Step 1: Add client types and tests**

Add to `console-plugins.ts`:

```ts
import type { ConsolePluginFormFieldSchema } from './console-model-providers';

export interface ConsoleHostInfrastructureProviderConfig {
  installation_id: string;
  extension_id: string;
  provider_code: string;
  display_name: string;
  description: string | null;
  runtime_status: string;
  desired_state: string;
  config_ref: string;
  contracts: string[];
  enabled_contracts: string[];
  config_schema: ConsolePluginFormFieldSchema[];
  config_json: Record<string, unknown>;
  restart_required: boolean;
}

export interface SaveConsoleHostInfrastructureProviderConfigInput {
  enabled_contracts: string[];
  config_json: Record<string, unknown>;
}
```

Add:

```ts
export function listConsoleHostInfrastructureProviders(baseUrl?: string) {
  return apiFetch<ConsoleHostInfrastructureProviderConfig[]>({
    path: '/api/console/settings/host-infrastructure/providers',
    baseUrl
  });
}

export function saveConsoleHostInfrastructureProviderConfig(
  installationId: string,
  providerCode: string,
  input: SaveConsoleHostInfrastructureProviderConfigInput,
  csrfToken: string,
  baseUrl?: string
) {
  return apiFetch<{
    restart_required: boolean;
    installation_desired_state: string;
    provider_config_status: string;
  }>({
    path: `/api/console/settings/host-infrastructure/providers/${installationId}/${providerCode}/config`,
    method: 'PUT',
    body: input,
    csrfToken,
    baseUrl
  });
}
```

Export these symbols from `web/packages/api-client/src/index.ts`.

 **Step 2: Run api-client targeted test**

Run:

```bash
node scripts/node/test-frontend.js fast -- settings-api
```

Expected: PASS.

 **Step 3: Format and commit Plan C**

Run:

```bash
cd api
cargo fmt
```

Commit:

```bash
git add api/crates/plugin-framework api/plugins/host-extensions api/crates/domain api/crates/control-plane api/crates/storage-durable/postgres api/apps/api-server web/packages/api-client/src web/app/src/features/settings/api/_tests/settings-api.test.ts
git commit -m "feat: add restart-scoped infrastructure provider config"
```
