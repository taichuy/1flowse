use domain::ActorContext;
use runtime_core::runtime_acl::RuntimeScopeGrant;
use runtime_core::runtime_engine::{
    RuntimeCreateInput, RuntimeDeleteInput, RuntimeEngine, RuntimeFilterInput, RuntimeGetInput,
    RuntimeListInput, RuntimeModelError, RuntimeSortInput, RuntimeUpdateInput,
};
use runtime_core::{model_metadata::ModelMetadata, resource_descriptor::ResourceDescriptor};
use serde_json::json;
use uuid::Uuid;

fn scope_grant(model_id: Uuid, scope_id: Uuid) -> RuntimeScopeGrant {
    RuntimeScopeGrant {
        data_model_id: model_id,
        scope_kind: domain::DataModelScopeKind::Workspace,
        scope_id,
        enabled: true,
        permission_profile: domain::ScopeDataModelPermissionProfile::ScopeAll,
    }
}

#[tokio::test]
async fn runtime_engine_runs_full_crud_against_repository_and_scope_context() {
    let engine = RuntimeEngine::for_tests();
    let root = ActorContext::root(Uuid::nil(), Uuid::nil(), "root");
    let grant = scope_grant(Uuid::nil(), Uuid::nil());
    let first = engine
        .create_record(RuntimeCreateInput {
            actor: root.clone(),
            model_code: "orders".into(),
            payload: json!({ "title": "A-001", "status": "draft" }),
            scope_grant: Some(grant.clone()),
        })
        .await
        .unwrap();

    let created = engine
        .create_record(RuntimeCreateInput {
            actor: root.clone(),
            model_code: "orders".into(),
            payload: json!({ "title": "A-002", "status": "paid" }),
            scope_grant: Some(grant.clone()),
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
            scope_grant: Some(grant.clone()),
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
            scope_grant: Some(grant.clone()),
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
            scope_grant: Some(grant.clone()),
        })
        .await
        .unwrap();
    assert_eq!(updated["title"], json!("A-002"));

    let deleted = engine
        .delete_record(RuntimeDeleteInput {
            actor: root,
            model_code: "orders".into(),
            record_id,
            scope_grant: Some(grant),
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
    let model_id = Uuid::now_v7();
    engine.registry().rebuild(vec![ModelMetadata {
        model_id,
        model_code: model_code.into(),
        status: domain::DataModelStatus::Published,
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
            scope_grant: Some(scope_grant(model_id, domain::SYSTEM_SCOPE_ID)),
        })
        .await
        .unwrap();
    let record_id = created["id"].as_str().unwrap().to_string();

    let fetched = engine
        .get_record(RuntimeGetInput {
            actor,
            model_code: model_code.into(),
            record_id,
            scope_grant: Some(scope_grant(model_id, domain::SYSTEM_SCOPE_ID)),
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
        status: domain::DataModelStatus::Published,
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
        status: domain::DataModelStatus::Published,
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
    let grant = scope_grant(workspace_metadata.model_id, workspace_id);

    engine
        .create_record(RuntimeCreateInput {
            actor: actor.clone(),
            model_code: model_code.into(),
            payload: json!({ "title": "workspace-order" }),
            scope_grant: Some(grant.clone()),
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
            scope_grant: Some(grant),
        })
        .await
        .unwrap();

    assert_eq!(listed.total, 1);
    assert_eq!(listed.items[0]["title"], json!("workspace-order"));
}

#[tokio::test]
async fn draft_model_is_visible_in_metadata_but_blocked_from_crud() {
    let engine = runtime_engine_for_status(domain::DataModelStatus::Draft);
    let actor = ActorContext::root(Uuid::now_v7(), Uuid::nil(), "root");

    assert!(engine
        .registry()
        .get(
            domain::DataModelScopeKind::Workspace,
            Uuid::nil(),
            "status_orders"
        )
        .is_some());

    assert_crud_blocked_by_model_error(
        &engine,
        actor,
        RuntimeModelError::not_published("status_orders"),
    )
    .await;
}

#[tokio::test]
async fn disabled_model_returns_disabled_error() {
    let engine = runtime_engine_for_status(domain::DataModelStatus::Disabled);
    let actor = ActorContext::root(Uuid::now_v7(), Uuid::nil(), "root");

    assert_crud_blocked_by_model_error(
        &engine,
        actor,
        RuntimeModelError::disabled("status_orders"),
    )
    .await;
}

#[tokio::test]
async fn broken_model_returns_broken_error() {
    let engine = runtime_engine_for_status(domain::DataModelStatus::Broken);
    let actor = ActorContext::root(Uuid::now_v7(), Uuid::nil(), "root");

    assert_crud_blocked_by_model_error(&engine, actor, RuntimeModelError::broken("status_orders"))
        .await;
}

#[tokio::test]
async fn api_exposure_status_does_not_by_itself_enable_runtime_crud() {
    let api_exposure_status = domain::ApiExposureStatus::ApiExposedReady;
    let engine = runtime_engine_for_status(domain::DataModelStatus::Draft);
    let actor = ActorContext::root(Uuid::now_v7(), Uuid::nil(), "root");

    assert_eq!(
        api_exposure_status,
        domain::ApiExposureStatus::ApiExposedReady
    );
    assert_model_error(
        engine
            .create_record(RuntimeCreateInput {
                actor,
                model_code: "status_orders".into(),
                payload: json!({ "title": "A-001" }),
                scope_grant: Some(scope_grant(Uuid::nil(), Uuid::nil())),
            })
            .await
            .unwrap_err(),
        RuntimeModelError::not_published("status_orders"),
    );
}

fn runtime_engine_for_status(status: domain::DataModelStatus) -> RuntimeEngine {
    let engine = RuntimeEngine::for_tests();
    engine
        .registry()
        .rebuild_with_status(vec![(status_model_metadata("status_orders"), status)]);
    engine
}

fn status_model_metadata(model_code: &str) -> ModelMetadata {
    ModelMetadata {
        model_id: Uuid::now_v7(),
        model_code: model_code.into(),
        status: domain::DataModelStatus::Published,
        scope_kind: domain::DataModelScopeKind::Workspace,
        scope_id: Uuid::nil(),
        physical_table_name: format!("rtm_workspace_demo_{model_code}"),
        scope_column_name: "scope_id".into(),
        fields: vec![],
        resource: ResourceDescriptor::runtime_model(
            model_code,
            domain::DataModelScopeKind::Workspace,
        ),
    }
}

async fn assert_crud_blocked_by_model_error(
    engine: &RuntimeEngine,
    actor: ActorContext,
    expected: RuntimeModelError,
) {
    assert_model_error(
        engine
            .list_records(RuntimeListInput {
                actor: actor.clone(),
                model_code: "status_orders".into(),
                filters: vec![],
                sorts: vec![],
                expand_relations: vec![],
                page: 1,
                page_size: 20,
                scope_grant: Some(scope_grant(Uuid::nil(), Uuid::nil())),
            })
            .await
            .unwrap_err(),
        expected.clone(),
    );
    assert_model_error(
        engine
            .get_record(RuntimeGetInput {
                actor: actor.clone(),
                model_code: "status_orders".into(),
                record_id: "missing".into(),
                scope_grant: Some(scope_grant(Uuid::nil(), Uuid::nil())),
            })
            .await
            .unwrap_err(),
        expected.clone(),
    );
    assert_model_error(
        engine
            .create_record(RuntimeCreateInput {
                actor: actor.clone(),
                model_code: "status_orders".into(),
                payload: json!({ "title": "A-001" }),
                scope_grant: Some(scope_grant(Uuid::nil(), Uuid::nil())),
            })
            .await
            .unwrap_err(),
        expected.clone(),
    );
    assert_model_error(
        engine
            .update_record(RuntimeUpdateInput {
                actor: actor.clone(),
                model_code: "status_orders".into(),
                record_id: "missing".into(),
                payload: json!({ "title": "A-002" }),
                scope_grant: Some(scope_grant(Uuid::nil(), Uuid::nil())),
            })
            .await
            .unwrap_err(),
        expected.clone(),
    );
    assert_model_error(
        engine
            .delete_record(RuntimeDeleteInput {
                actor,
                model_code: "status_orders".into(),
                record_id: "missing".into(),
                scope_grant: Some(scope_grant(Uuid::nil(), Uuid::nil())),
            })
            .await
            .unwrap_err(),
        expected,
    );
}

fn assert_model_error(error: anyhow::Error, expected: RuntimeModelError) {
    let actual = error.downcast_ref::<RuntimeModelError>().unwrap();
    assert_eq!(actual, &expected);
}
