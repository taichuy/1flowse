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
