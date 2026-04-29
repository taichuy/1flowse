use control_plane::resource_action::{
    ActionDefinition, ResourceActionRegistry, ResourceDefinition, ResourceScopeKind,
};

#[test]
fn registry_rejects_duplicate_action() {
    let mut registry = ResourceActionRegistry::default();
    registry
        .register_resource(ResourceDefinition::core("plugins", ResourceScopeKind::System))
        .unwrap();
    registry
        .register_action(ActionDefinition::core("plugins", "install"))
        .unwrap();

    let err = registry
        .register_action(ActionDefinition::core("plugins", "install"))
        .unwrap_err();
    assert!(err.to_string().contains("duplicate action"));
}

#[test]
fn registry_requires_existing_resource() {
    let mut registry = ResourceActionRegistry::default();
    let err = registry
        .register_action(ActionDefinition::core("files", "upload"))
        .unwrap_err();
    assert!(err.to_string().contains("resource not registered"));
}
