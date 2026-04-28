use control_plane::host_extension_boot::register_builtin_host_extensions;
use plugin_framework::parse_host_extension_manifest;

#[test]
fn builtin_manifests_populate_contract_slot_and_storage_registry() {
    let manifests = vec![
        r#"
manifest_version: 1
extension_id: official.storage-host
version: 0.1.0
display_name: Storage Host
source_kind: builtin
trust_level: trusted_host
activation_phase: boot
provides_contracts: [storage-durable, storage-ephemeral, storage-object]
overrides_contracts: []
registers_slots: []
registers_interfaces: []
registers_storage:
  - { kind: storage-durable, implementation: postgres }
  - { kind: storage-ephemeral, implementation: memory }
dependencies: []
load_order: { after: [], before: [] }
"#,
        r#"
manifest_version: 1
extension_id: official.data-access-host
version: 0.1.0
display_name: Data Access Host
source_kind: builtin
trust_level: trusted_host
activation_phase: boot
provides_contracts: [data_access]
overrides_contracts: []
registers_slots: [data_source]
registers_interfaces: []
registers_storage: []
dependencies: []
load_order: { after: [], before: [] }
"#,
    ];
    let parsed = manifests
        .into_iter()
        .map(|raw| parse_host_extension_manifest(raw).unwrap())
        .collect::<Vec<_>>();
    let registry = register_builtin_host_extensions(&parsed).expect("registry should build");

    assert_eq!(
        registry.contract_provider("storage-durable"),
        Some("official.storage-host")
    );
    assert_eq!(
        registry.storage_implementation("storage-durable"),
        Some("postgres")
    );
    assert_eq!(
        registry.slot_provider("data_source"),
        Some("official.data-access-host")
    );
}
