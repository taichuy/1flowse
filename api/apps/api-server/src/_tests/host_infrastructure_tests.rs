#[test]
fn local_infra_host_provides_required_defaults() {
    let registry = crate::host_infrastructure::build_local_host_infrastructure();

    assert_eq!(
        registry.default_provider("storage-ephemeral").unwrap(),
        "local"
    );
    assert_eq!(registry.default_provider("cache-store").unwrap(), "local");
    assert_eq!(registry.default_provider("event-bus").unwrap(), "local");
    assert!(registry.session_store().is_some());
}

#[test]
fn duplicate_default_provider_is_rejected() {
    let mut registry = crate::host_infrastructure::HostInfrastructureRegistry::default();
    registry
        .register_default_provider("storage-ephemeral", "local", "local-infra-host")
        .unwrap();
    let err = registry
        .register_default_provider("storage-ephemeral", "redis", "redis-infra-host")
        .unwrap_err();

    assert!(err.to_string().contains("default provider"));
}
