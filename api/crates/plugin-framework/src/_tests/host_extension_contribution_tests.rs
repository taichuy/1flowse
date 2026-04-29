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
    assert_eq!(
        manifest.infrastructure_providers[0].contract,
        "storage-ephemeral"
    );
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

#[test]
fn parses_structured_route_worker_and_migration_declarations() {
    let raw = r#"
schema_version: 1flowbase.host-extension/v1
extension_id: file-security
version: 0.1.0
bootstrap_phase: boot
native:
  abi_version: 1flowbase.host.native/v1
  library: lib/file_security_host
  entry_symbol: oneflowbase_host_extension_entry_v1
owned_resources: []
extends_resources: []
infrastructure_providers: []
routes:
  - route_id: file-security.scan-report
    method: GET
    path: /api/system/file-security/files/{file_id}/scan-report
    action:
      resource: file_scan_reports
      action: get
workers:
  - worker_id: file-security.scan-worker
    queue: file-security.scan
    handler: scan_file
migrations:
  - id: 0001_create_file_security_tables
    path: migrations/postgres/0001_create_file_security_tables.sql
"#;

    let manifest = parse_host_extension_contribution_manifest(raw).unwrap();

    assert_eq!(manifest.routes[0].route_id, "file-security.scan-report");
    assert_eq!(manifest.routes[0].method, "GET");
    assert_eq!(
        manifest.routes[0].path,
        "/api/system/file-security/files/{file_id}/scan-report"
    );
    assert_eq!(manifest.routes[0].action.resource, "file_scan_reports");
    assert_eq!(manifest.routes[0].action.action, "get");
    assert_eq!(manifest.workers[0].worker_id, "file-security.scan-worker");
    assert_eq!(manifest.workers[0].queue, "file-security.scan");
    assert_eq!(manifest.workers[0].handler, "scan_file");
    assert_eq!(
        manifest.migrations[0].path,
        "migrations/postgres/0001_create_file_security_tables.sql"
    );
}

#[test]
fn rejects_route_path_outside_controlled_host_prefixes() {
    let raw = host_extension_manifest_with(
        r#"
routes:
  - route_id: file-security.scan-report
    method: GET
    path: /api/raw/file-security
    action:
      resource: file_scan_reports
      action: get
workers: []
migrations: []
"#,
    );

    let err = parse_host_extension_contribution_manifest(&raw).unwrap_err();
    assert!(err.to_string().contains("routes[].path"));
}

#[test]
fn rejects_worker_id_without_extension_owned_prefix() {
    let raw = host_extension_manifest_with(
        r#"
routes: []
workers:
  - worker_id: other.scan-worker
    queue: file-security.scan
    handler: scan_file
migrations: []
"#,
    );

    let err = parse_host_extension_contribution_manifest(&raw).unwrap_err();
    assert!(err.to_string().contains("workers[].worker_id"));
}

#[test]
fn rejects_migration_path_outside_postgres_migrations() {
    let raw = host_extension_manifest_with(
        r#"
routes: []
workers: []
migrations:
  - id: 0001_create_file_security_tables
    path: ../core/0001.sql
"#,
    );

    let err = parse_host_extension_contribution_manifest(&raw).unwrap_err();
    assert!(err.to_string().contains("migrations[].path"));
}

fn host_extension_manifest_with(contributions: &str) -> String {
    format!(
        r#"
schema_version: 1flowbase.host-extension/v1
extension_id: file-security
version: 0.1.0
bootstrap_phase: boot
native:
  abi_version: 1flowbase.host.native/v1
  library: lib/file_security_host
  entry_symbol: oneflowbase_host_extension_entry_v1
owned_resources: []
extends_resources: []
infrastructure_providers: []
{contributions}
"#
    )
}
