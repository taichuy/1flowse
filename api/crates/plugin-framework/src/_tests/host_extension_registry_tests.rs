use plugin_framework::{HostExtensionRegistry, RegisteredHostExtension};

#[test]
fn registry_rejects_duplicate_contract_without_override() {
    let mut registry = HostExtensionRegistry::default();
    registry
        .register(RegisteredHostExtension {
            extension_id: "official.storage-host".into(),
            provides_contracts: vec!["storage-durable".into()],
            overrides_contracts: vec![],
            registers_slots: vec![],
            registers_storage: vec![("storage-durable".into(), "postgres".into())],
        })
        .expect("first registration should pass");

    let error = registry
        .register(RegisteredHostExtension {
            extension_id: "custom.storage-host".into(),
            provides_contracts: vec!["storage-durable".into()],
            overrides_contracts: vec![],
            registers_slots: vec![],
            registers_storage: vec![("storage-durable".into(), "cockroach".into())],
        })
        .expect_err("duplicate contract requires override");

    assert!(error.to_string().contains("storage-durable"));
}

#[test]
fn registry_allows_explicit_contract_override() {
    let mut registry = HostExtensionRegistry::default();
    registry
        .register(RegisteredHostExtension {
            extension_id: "official.storage-host".into(),
            provides_contracts: vec!["storage-ephemeral".into()],
            overrides_contracts: vec![],
            registers_slots: vec![],
            registers_storage: vec![("storage-ephemeral".into(), "memory".into())],
        })
        .expect("first registration should pass");

    registry
        .register(RegisteredHostExtension {
            extension_id: "custom.redis-host".into(),
            provides_contracts: vec![],
            overrides_contracts: vec!["storage-ephemeral".into()],
            registers_slots: vec![],
            registers_storage: vec![("storage-ephemeral".into(), "redis".into())],
        })
        .expect("explicit override should pass");

    assert_eq!(
        registry.contract_provider("storage-ephemeral"),
        Some("custom.redis-host")
    );
}
