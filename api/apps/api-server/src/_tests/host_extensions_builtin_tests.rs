use api_server::host_extensions::builtin::builtin_host_extension_manifests;
use plugin_framework::parse_host_extension_manifest;

#[test]
fn storage_host_registers_all_storage_contracts() {
    let manifests = builtin_host_extension_manifests();
    let storage = manifests
        .iter()
        .find(|raw| raw.contains("extension_id: official.storage-host"))
        .expect("storage-host manifest should exist");
    let manifest = parse_host_extension_manifest(storage).expect("storage manifest should parse");

    assert!(manifest
        .provides_contracts
        .contains(&"storage-durable".to_string()));
    assert!(manifest
        .provides_contracts
        .contains(&"storage-ephemeral".to_string()));
    assert!(manifest
        .provides_contracts
        .contains(&"storage-object".to_string()));
    assert!(manifest
        .registers_storage
        .iter()
        .any(|entry| { entry.kind == "storage-durable" && entry.implementation == "postgres" }));
}

#[test]
fn data_and_file_hosts_register_runtime_slots() {
    let manifests = builtin_host_extension_manifests();
    let parsed = manifests
        .iter()
        .map(|raw| parse_host_extension_manifest(raw).expect("manifest should parse"))
        .collect::<Vec<_>>();

    let data_access = parsed
        .iter()
        .find(|manifest| manifest.extension_id == "official.data-access-host")
        .expect("data-access-host should exist");
    assert!(data_access
        .registers_slots
        .contains(&"data_source".to_string()));

    let file_management = parsed
        .iter()
        .find(|manifest| manifest.extension_id == "official.file-management-host")
        .expect("file-management-host should exist");
    assert!(file_management
        .registers_slots
        .contains(&"file_processor".to_string()));
}
