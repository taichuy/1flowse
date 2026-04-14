use domain::ActorContext;
use runtime_core::runtime_engine::{
    RuntimeCreateInput, RuntimeDeleteInput, RuntimeEngine, RuntimeFilterInput, RuntimeGetInput,
    RuntimeListInput, RuntimeSortInput, RuntimeUpdateInput,
};
use runtime_core::{model_metadata::ModelMetadata, resource_descriptor::ResourceDescriptor};
use serde_json::json;
use uuid::Uuid;

#[tokio::test]
async fn runtime_engine_runs_full_crud_against_repository_and_scope_context() {
    let engine = RuntimeEngine::for_tests();
    let root = ActorContext::root(Uuid::nil(), Uuid::nil(), "root");
    let first = engine
        .create_record(RuntimeCreateInput {
            actor: root.clone(),
            model_code: "orders".into(),
            payload: json!({ "title": "A-001", "status": "draft" }),
        })
        .await
        .unwrap();

    let created = engine
        .create_record(RuntimeCreateInput {
            actor: root.clone(),
            model_code: "orders".into(),
            payload: json!({ "title": "A-002", "status": "paid" }),
        })
        .await
        .unwrap();

    let first_record_id = first["id"].as_str().unwrap().to_string();
    let record_id = created["id"].as_str().unwrap().to_string();

    let listed = engine
        .list_records(RuntimeListInput {
            actor: root.clone(),
            model_code: "orders".into(),
            filters: vec![RuntimeFilterInput {
                field_code: "status".into(),
                operator: "eq".into(),
                value: json!("paid"),
            }],
            sorts: vec![RuntimeSortInput {
                field_code: "title".into(),
                direction: "desc".into(),
            }],
            expand_relations: vec![],
            page: 1,
            page_size: 20,
        })
        .await
        .unwrap();
    assert_eq!(listed.items.len(), 1);
    assert_eq!(listed.items[0]["title"], json!("A-002"));

    let fetched = engine
        .get_record(RuntimeGetInput {
            actor: root.clone(),
            model_code: "orders".into(),
            record_id: first_record_id,
        })
        .await
        .unwrap()
        .unwrap();
    assert_eq!(fetched["title"], json!("A-001"));

    let updated = engine
        .update_record(RuntimeUpdateInput {
            actor: root.clone(),
            model_code: "orders".into(),
            record_id: record_id.clone(),
            payload: json!({ "title": "A-002" }),
        })
        .await
        .unwrap();
    assert_eq!(updated["title"], json!("A-002"));

    let deleted = engine
        .delete_record(RuntimeDeleteInput {
            actor: root,
            model_code: "orders".into(),
            record_id,
        })
        .await
        .unwrap();
    assert_eq!(deleted["deleted"], json!(true));
}

#[tokio::test]
async fn runtime_engine_uses_fixed_system_scope_id_for_system_models() {
    let engine = RuntimeEngine::for_tests();
    let actor = ActorContext::root(Uuid::now_v7(), Uuid::now_v7(), "root");
    let model_code = "system_orders";
    engine.registry().rebuild(vec![ModelMetadata {
        model_id: Uuid::now_v7(),
        model_code: model_code.into(),
        scope_kind: domain::DataModelScopeKind::System,
        scope_id: domain::SYSTEM_SCOPE_ID,
        physical_table_name: "rtm_system_demo_orders".into(),
        scope_column_name: "scope_id".into(),
        fields: vec![],
        resource: ResourceDescriptor::runtime_model(model_code, domain::DataModelScopeKind::System),
    }]);

    let created = engine
        .create_record(RuntimeCreateInput {
            actor: actor.clone(),
            model_code: model_code.into(),
            payload: json!({ "title": "system-order" }),
        })
        .await
        .unwrap();
    let record_id = created["id"].as_str().unwrap().to_string();

    let fetched = engine
        .get_record(RuntimeGetInput {
            actor,
            model_code: model_code.into(),
            record_id,
        })
        .await
        .unwrap()
        .unwrap();

    assert_eq!(fetched["title"], json!("system-order"));
}

#[tokio::test]
async fn runtime_engine_prefers_workspace_metadata_before_system_fallback() {
    let engine = RuntimeEngine::for_tests();
    let workspace_id = Uuid::now_v7();
    let actor = ActorContext::root(Uuid::now_v7(), workspace_id, "root");
    let model_code = "shared_orders";
    let workspace_metadata = ModelMetadata {
        model_id: Uuid::now_v7(),
        model_code: model_code.into(),
        scope_kind: domain::DataModelScopeKind::Workspace,
        scope_id: workspace_id,
        physical_table_name: "rtm_workspace_demo_orders".into(),
        scope_column_name: "scope_id".into(),
        fields: vec![],
        resource: ResourceDescriptor::runtime_model(
            model_code,
            domain::DataModelScopeKind::Workspace,
        ),
    };
    let system_metadata = ModelMetadata {
        model_id: Uuid::now_v7(),
        model_code: model_code.into(),
        scope_kind: domain::DataModelScopeKind::System,
        scope_id: domain::SYSTEM_SCOPE_ID,
        physical_table_name: "rtm_system_demo_orders".into(),
        scope_column_name: "scope_id".into(),
        fields: vec![],
        resource: ResourceDescriptor::runtime_model(model_code, domain::DataModelScopeKind::System),
    };
    engine
        .registry()
        .rebuild(vec![workspace_metadata.clone(), system_metadata]);

    engine
        .create_record(RuntimeCreateInput {
            actor: actor.clone(),
            model_code: model_code.into(),
            payload: json!({ "title": "workspace-order" }),
        })
        .await
        .unwrap();

    engine.registry().rebuild(vec![workspace_metadata]);

    let listed = engine
        .list_records(RuntimeListInput {
            actor,
            model_code: model_code.into(),
            filters: vec![],
            sorts: vec![],
            expand_relations: vec![],
            page: 1,
            page_size: 20,
        })
        .await
        .unwrap();

    assert_eq!(listed.total, 1);
    assert_eq!(listed.items[0]["title"], json!("workspace-order"));
}
