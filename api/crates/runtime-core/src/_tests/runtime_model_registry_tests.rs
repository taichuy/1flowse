use runtime_core::runtime_model_registry::{RuntimeDataModelAvailability, RuntimeModelRegistry};

#[test]
fn runtime_model_registry_rebuilds_and_refreshes_by_model_code() {
    let registry = RuntimeModelRegistry::default();
    registry.rebuild(vec![model_metadata("orders")]);

    assert!(registry
        .get(
            domain::DataModelScopeKind::Workspace,
            uuid::Uuid::nil(),
            "orders"
        )
        .is_some());
}

#[test]
fn published_model_registers_as_runtime_available() {
    let registry = RuntimeModelRegistry::default();
    registry.rebuild_with_status(vec![(
        model_metadata("orders"),
        domain::DataModelStatus::Published,
    )]);

    let registered = registry
        .get_runtime_model(
            domain::DataModelScopeKind::Workspace,
            uuid::Uuid::nil(),
            "orders",
        )
        .unwrap();

    assert_eq!(
        registered.availability,
        RuntimeDataModelAvailability::Available
    );
}

fn model_metadata(model_code: &str) -> runtime_core::model_metadata::ModelMetadata {
    runtime_core::model_metadata::ModelMetadata {
        model_id: uuid::Uuid::nil(),
        model_code: model_code.into(),
        scope_kind: domain::DataModelScopeKind::Workspace,
        scope_id: uuid::Uuid::nil(),
        physical_table_name: format!("rtm_workspace_demo_{model_code}"),
        scope_column_name: "scope_id".into(),
        fields: vec![],
        resource: runtime_core::resource_descriptor::ResourceDescriptor::runtime_model(
            model_code,
            domain::DataModelScopeKind::Workspace,
        ),
    }
}
