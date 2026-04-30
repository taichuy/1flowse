use control_plane::ports::{
    AppendCreditLedgerInput, AppendModelFailoverAttemptLedgerInput, AppendRunEventInput,
    AppendRuntimeEventInput, AppendRuntimeSpanInput, AppendUsageLedgerInput, ApplicationRepository,
    CreateApplicationInput, CreateCallbackTaskInput, CreateCheckpointInput, CreateFlowRunInput,
    CreateNodeRunInput, FlowRepository, LinkUsageLedgerToModelFailoverAttemptInput,
    OrchestrationRuntimeRepository, UpdateNodeRunInput, UpsertCompiledPlanInput,
};
use domain::{ApplicationType, CallbackTaskStatus, FlowRunMode, FlowRunStatus, NodeRunStatus};
use serde_json::json;
use sqlx::PgPool;
use storage_postgres::{connect, run_migrations, PgControlPlaneStore};
use time::{macros::datetime, Duration, OffsetDateTime};
use uuid::Uuid;

fn base_database_url() -> String {
    std::env::var("DATABASE_URL")
        .unwrap_or_else(|_| "postgres://postgres:1flowbase@127.0.0.1:35432/1flowbase".into())
}

async fn isolated_database_url() -> String {
    let admin_pool = PgPool::connect(&base_database_url()).await.unwrap();
    let schema = format!("test_{}", Uuid::now_v7().simple());
    sqlx::query(&format!("create schema if not exists {schema}"))
        .execute(&admin_pool)
        .await
        .unwrap();

    format!("{}?options=-csearch_path%3D{schema}", base_database_url())
}

async fn root_tenant_id(store: &PgControlPlaneStore) -> Uuid {
    sqlx::query_scalar("select id from tenants where code = 'root-tenant'")
        .fetch_one(store.pool())
        .await
        .unwrap()
}

async fn seed_workspace(store: &PgControlPlaneStore, name: &str) -> Uuid {
    let workspace_id = Uuid::now_v7();
    sqlx::query(
        "insert into workspaces (id, tenant_id, name, created_by, updated_by) values ($1, $2, $3, null, null)",
    )
    .bind(workspace_id)
    .bind(root_tenant_id(store).await)
    .bind(name)
    .execute(store.pool())
    .await
    .unwrap();
    workspace_id
}

async fn seed_user(store: &PgControlPlaneStore, workspace_id: Uuid, account_prefix: &str) -> Uuid {
    let user_id = Uuid::now_v7();
    let account = format!("{account_prefix}-{}", user_id.simple());
    sqlx::query(
        r#"
        insert into users (
            id, account, email, phone, password_hash, name, nickname, avatar_url, introduction,
            default_display_role, email_login_enabled, phone_login_enabled, status, session_version,
            created_by, updated_by
        ) values (
            $1, $2, $3, null, 'hash', $4, $5, null, '', 'manager', true, false, 'active', 1, null, null
        )
        "#,
    )
    .bind(user_id)
    .bind(&account)
    .bind(format!("{account}@example.com"))
    .bind(&account)
    .bind(&account)
    .execute(store.pool())
    .await
    .unwrap();

    sqlx::query(
        "insert into workspace_memberships (id, workspace_id, user_id, introduction) values ($1, $2, $3, '')",
    )
    .bind(Uuid::now_v7())
    .bind(workspace_id)
    .bind(user_id)
    .execute(store.pool())
    .await
    .unwrap();

    user_id
}

#[derive(Debug, Clone)]
struct RuntimeSeedState {
    application_id: Uuid,
    actor_user_id: Uuid,
    flow_id: Uuid,
    draft_id: Uuid,
    draft_updated_at: OffsetDateTime,
}

async fn seed_runtime_base(store: &PgControlPlaneStore) -> RuntimeSeedState {
    let workspace_id = seed_workspace(store, "Runtime").await;
    let actor_user_id = seed_user(store, workspace_id, "runtime-owner").await;
    let application = <PgControlPlaneStore as ApplicationRepository>::create_application(
        store,
        &CreateApplicationInput {
            actor_user_id,
            workspace_id,
            application_type: ApplicationType::AgentFlow,
            name: "Runtime App".into(),
            description: "runtime".into(),
            icon: None,
            icon_type: None,
            icon_background: None,
        },
    )
    .await
    .unwrap();
    let editor_state = <PgControlPlaneStore as FlowRepository>::get_or_create_editor_state(
        store,
        workspace_id,
        application.id,
        actor_user_id,
    )
    .await
    .unwrap();

    RuntimeSeedState {
        application_id: application.id,
        actor_user_id,
        flow_id: editor_state.flow.id,
        draft_id: editor_state.draft.id,
        draft_updated_at: editor_state.draft.updated_at,
    }
}

async fn seed_compiled_plan(
    store: &PgControlPlaneStore,
    seeded: &RuntimeSeedState,
) -> domain::CompiledPlanRecord {
    <PgControlPlaneStore as OrchestrationRuntimeRepository>::upsert_compiled_plan(
        store,
        &UpsertCompiledPlanInput {
            actor_user_id: seeded.actor_user_id,
            flow_id: seeded.flow_id,
            flow_draft_id: seeded.draft_id,
            schema_version: "1flowbase.flow/v1".into(),
            document_updated_at: seeded.draft_updated_at,
            plan: json!({
                "schema_version": "1flowbase.flow/v1",
                "topological_order": ["node-start", "node-llm"]
            }),
        },
    )
    .await
    .unwrap()
}

async fn seed_flow_run(
    store: &PgControlPlaneStore,
    seeded: &RuntimeSeedState,
    compiled: &domain::CompiledPlanRecord,
    started_at: OffsetDateTime,
) -> domain::FlowRunRecord {
    seed_flow_run_with_mode(
        store,
        seeded,
        compiled,
        started_at,
        FlowRunMode::DebugNodePreview,
        Some("node-llm".into()),
    )
    .await
}

async fn seed_flow_run_with_mode(
    store: &PgControlPlaneStore,
    seeded: &RuntimeSeedState,
    compiled: &domain::CompiledPlanRecord,
    started_at: OffsetDateTime,
    run_mode: FlowRunMode,
    target_node_id: Option<String>,
) -> domain::FlowRunRecord {
    <PgControlPlaneStore as OrchestrationRuntimeRepository>::create_flow_run(
        store,
        &CreateFlowRunInput {
            actor_user_id: seeded.actor_user_id,
            application_id: seeded.application_id,
            flow_id: seeded.flow_id,
            flow_draft_id: seeded.draft_id,
            compiled_plan_id: compiled.id,
            run_mode,
            target_node_id,
            status: FlowRunStatus::Running,
            input_payload: json!({ "node-start": { "query": "总结退款政策" } }),
            started_at,
        },
    )
    .await
    .unwrap()
}

async fn seed_node_run(
    store: &PgControlPlaneStore,
    flow_run: &domain::FlowRunRecord,
    started_at: OffsetDateTime,
) -> domain::NodeRunRecord {
    seed_node_run_for(
        store,
        flow_run,
        "node-llm",
        "llm",
        "LLM",
        json!({ "user_prompt": "总结退款政策" }),
        started_at,
    )
    .await
}

async fn seed_node_run_for(
    store: &PgControlPlaneStore,
    flow_run: &domain::FlowRunRecord,
    node_id: &str,
    node_type: &str,
    node_alias: &str,
    input_payload: serde_json::Value,
    started_at: OffsetDateTime,
) -> domain::NodeRunRecord {
    <PgControlPlaneStore as OrchestrationRuntimeRepository>::create_node_run(
        store,
        &CreateNodeRunInput {
            flow_run_id: flow_run.id,
            node_id: node_id.into(),
            node_type: node_type.into(),
            node_alias: node_alias.into(),
            status: NodeRunStatus::Running,
            input_payload,
            started_at,
        },
    )
    .await
    .unwrap()
}

async fn append_event(
    store: &PgControlPlaneStore,
    flow_run: &domain::FlowRunRecord,
    node_run: Option<&domain::NodeRunRecord>,
    event_type: &str,
) -> domain::RunEventRecord {
    <PgControlPlaneStore as OrchestrationRuntimeRepository>::append_run_event(
        store,
        &AppendRunEventInput {
            flow_run_id: flow_run.id,
            node_run_id: node_run.map(|value| value.id),
            event_type: event_type.into(),
            payload: json!({ "event_type": event_type }),
        },
    )
    .await
    .unwrap()
}

#[tokio::test]
async fn orchestration_runtime_repository_persists_compiled_plan_runs_and_events() {
    let pool = connect(&isolated_database_url().await).await.unwrap();
    run_migrations(&pool).await.unwrap();
    let store = PgControlPlaneStore::new(pool);
    let seeded = seed_runtime_base(&store).await;
    let compiled = seed_compiled_plan(&store, &seeded).await;
    let started_at = datetime!(2026-04-17 09:00:00 UTC);
    let run = seed_flow_run(&store, &seeded, &compiled, started_at).await;
    let node_run = seed_node_run(&store, &run, started_at + Duration::seconds(1)).await;
    append_event(&store, &run, Some(&node_run), "node_run_completed").await;

    let detail =
        <PgControlPlaneStore as OrchestrationRuntimeRepository>::get_application_run_detail(
            &store,
            run.application_id,
            run.id,
        )
        .await
        .unwrap()
        .unwrap();

    assert_eq!(detail.flow_run.id, run.id);
    assert_eq!(detail.node_runs.len(), 1);
    assert_eq!(detail.events[0].event_type, "node_run_completed");
}

#[tokio::test]
async fn orchestration_runtime_repository_batch_appends_run_and_runtime_events() {
    let pool = connect(&isolated_database_url().await).await.unwrap();
    run_migrations(&pool).await.unwrap();
    let store = PgControlPlaneStore::new(pool);
    let seeded = seed_runtime_base(&store).await;
    let compiled = seed_compiled_plan(&store, &seeded).await;
    let started_at = datetime!(2026-04-17 09:00:00 UTC);
    let run = seed_flow_run(&store, &seeded, &compiled, started_at).await;

    let run_events = <PgControlPlaneStore as OrchestrationRuntimeRepository>::append_run_events(
        &store,
        &[
            AppendRunEventInput {
                flow_run_id: run.id,
                node_run_id: None,
                event_type: "text_delta".into(),
                payload: json!({ "delta": "hello" }),
            },
            AppendRunEventInput {
                flow_run_id: run.id,
                node_run_id: None,
                event_type: "finish".into(),
                payload: json!({ "reason": "stop" }),
            },
        ],
    )
    .await
    .unwrap();
    let runtime_events =
        <PgControlPlaneStore as OrchestrationRuntimeRepository>::append_runtime_events(
            &store,
            &[
                AppendRuntimeEventInput {
                    flow_run_id: run.id,
                    node_run_id: None,
                    span_id: None,
                    parent_span_id: None,
                    event_type: "text_delta".into(),
                    layer: domain::RuntimeEventLayer::ProviderRaw,
                    source: domain::RuntimeEventSource::Host,
                    trust_level: domain::RuntimeTrustLevel::HostFact,
                    item_id: None,
                    ledger_ref: None,
                    payload: json!({ "delta": "hello" }),
                    visibility: domain::RuntimeEventVisibility::Workspace,
                    durability: domain::RuntimeEventDurability::Durable,
                },
                AppendRuntimeEventInput {
                    flow_run_id: run.id,
                    node_run_id: None,
                    span_id: None,
                    parent_span_id: None,
                    event_type: "finish".into(),
                    layer: domain::RuntimeEventLayer::ProviderRaw,
                    source: domain::RuntimeEventSource::Host,
                    trust_level: domain::RuntimeTrustLevel::HostFact,
                    item_id: None,
                    ledger_ref: None,
                    payload: json!({ "reason": "stop" }),
                    visibility: domain::RuntimeEventVisibility::Workspace,
                    durability: domain::RuntimeEventDurability::Durable,
                },
            ],
        )
        .await
        .unwrap();

    assert_eq!(
        run_events
            .iter()
            .map(|event| (event.sequence, event.event_type.as_str()))
            .collect::<Vec<_>>(),
        vec![(1, "text_delta"), (2, "finish")]
    );
    assert_eq!(
        runtime_events
            .iter()
            .map(|event| (event.sequence, event.event_type.as_str()))
            .collect::<Vec<_>>(),
        vec![(1, "text_delta"), (2, "finish")]
    );
}

#[tokio::test]
async fn orchestration_runtime_repository_persists_waiting_human_checkpoint() {
    let pool = connect(&isolated_database_url().await).await.unwrap();
    run_migrations(&pool).await.unwrap();
    let store = PgControlPlaneStore::new(pool);
    let seeded = seed_runtime_base(&store).await;
    let compiled = seed_compiled_plan(&store, &seeded).await;
    let started_at = datetime!(2026-04-17 10:00:00 UTC);
    let run = seed_flow_run_with_mode(
        &store,
        &seeded,
        &compiled,
        started_at,
        FlowRunMode::DebugFlowRun,
        None,
    )
    .await;
    let node_run = seed_node_run_for(
        &store,
        &run,
        "node-human",
        "human_input",
        "Human Input",
        json!({ "prompt": "请人工审核" }),
        started_at + Duration::seconds(1),
    )
    .await;

    <PgControlPlaneStore as OrchestrationRuntimeRepository>::update_node_run(
        &store,
        &UpdateNodeRunInput {
            node_run_id: node_run.id,
            status: NodeRunStatus::WaitingHuman,
            output_payload: json!({}),
            error_payload: None,
            metrics_payload: json!({}),
            finished_at: None,
        },
    )
    .await
    .unwrap();
    <PgControlPlaneStore as OrchestrationRuntimeRepository>::create_checkpoint(
        &store,
        &CreateCheckpointInput {
            flow_run_id: run.id,
            node_run_id: Some(node_run.id),
            status: "waiting_human".to_string(),
            reason: "等待人工输入".to_string(),
            locator_payload: json!({ "node_id": "node-human", "next_node_index": 3 }),
            variable_snapshot: json!({ "node-llm": { "text": "草稿回复" } }),
            external_ref_payload: Some(json!({ "prompt": "请人工审核" })),
        },
    )
    .await
    .unwrap();

    let detail =
        <PgControlPlaneStore as OrchestrationRuntimeRepository>::get_application_run_detail(
            &store,
            run.application_id,
            run.id,
        )
        .await
        .unwrap()
        .unwrap();

    assert_eq!(detail.flow_run.run_mode.as_str(), "debug_flow_run");
    assert_eq!(detail.checkpoints[0].status, "waiting_human");
    assert_eq!(
        detail.checkpoints[0].external_ref_payload.as_ref().unwrap()["prompt"],
        json!("请人工审核")
    );
}

#[tokio::test]
async fn orchestration_runtime_repository_returns_callback_tasks_with_run_detail() {
    let pool = connect(&isolated_database_url().await).await.unwrap();
    run_migrations(&pool).await.unwrap();
    let store = PgControlPlaneStore::new(pool);
    let seeded = seed_runtime_base(&store).await;
    let compiled = seed_compiled_plan(&store, &seeded).await;
    let started_at = datetime!(2026-04-17 11:00:00 UTC);
    let run = seed_flow_run_with_mode(
        &store,
        &seeded,
        &compiled,
        started_at,
        FlowRunMode::DebugFlowRun,
        None,
    )
    .await;
    let node_run = seed_node_run_for(
        &store,
        &run,
        "node-tool",
        "tool",
        "Tool",
        json!({ "tool_name": "lookup_order" }),
        started_at + Duration::seconds(1),
    )
    .await;

    let task = <PgControlPlaneStore as OrchestrationRuntimeRepository>::create_callback_task(
        &store,
        &CreateCallbackTaskInput {
            flow_run_id: run.id,
            node_run_id: node_run.id,
            callback_kind: "tool".to_string(),
            request_payload: json!({ "tool_name": "lookup_order" }),
            external_ref_payload: Some(json!({ "tool_name": "lookup_order" })),
        },
    )
    .await
    .unwrap();

    let detail =
        <PgControlPlaneStore as OrchestrationRuntimeRepository>::get_application_run_detail(
            &store,
            run.application_id,
            run.id,
        )
        .await
        .unwrap()
        .unwrap();

    assert_eq!(detail.callback_tasks.len(), 1);
    assert_eq!(detail.callback_tasks[0].callback_kind, "tool");
    assert_eq!(detail.callback_tasks[0].status, CallbackTaskStatus::Pending);
    assert_eq!(detail.callback_tasks[0].id, task.id);
}

#[tokio::test]
async fn latest_node_run_returns_most_recent_run_for_node() {
    let pool = connect(&isolated_database_url().await).await.unwrap();
    run_migrations(&pool).await.unwrap();
    let store = PgControlPlaneStore::new(pool);
    let seeded = seed_runtime_base(&store).await;
    let compiled = seed_compiled_plan(&store, &seeded).await;
    let first_started_at = datetime!(2026-04-17 09:00:00 UTC);
    let second_started_at = first_started_at + Duration::minutes(5);
    let first_run = seed_flow_run(&store, &seeded, &compiled, first_started_at).await;
    let _ = seed_node_run(&store, &first_run, first_started_at + Duration::seconds(1)).await;
    let second_run = seed_flow_run(&store, &seeded, &compiled, second_started_at).await;
    let second_node_run = seed_node_run(
        &store,
        &second_run,
        second_started_at + Duration::seconds(1),
    )
    .await;

    let node_last_run =
        <PgControlPlaneStore as OrchestrationRuntimeRepository>::get_latest_node_run(
            &store,
            seeded.application_id,
            "node-llm",
        )
        .await
        .unwrap()
        .unwrap();

    assert_eq!(node_last_run.node_run.id, second_node_run.id);
}

#[tokio::test]
async fn runtime_fact_spine_preserves_span_sequence_and_trust_level() {
    let pool = connect(&isolated_database_url().await).await.unwrap();
    run_migrations(&pool).await.unwrap();
    let store = PgControlPlaneStore::new(pool);
    let seeded = seed_runtime_base(&store).await;
    let compiled = seed_compiled_plan(&store, &seeded).await;
    let started_at = datetime!(2026-04-27 09:00:00 UTC);
    let run = seed_flow_run_with_mode(
        &store,
        &seeded,
        &compiled,
        started_at,
        FlowRunMode::DebugFlowRun,
        None,
    )
    .await;

    let span = <PgControlPlaneStore as OrchestrationRuntimeRepository>::append_runtime_span(
        &store,
        &AppendRuntimeSpanInput {
            flow_run_id: run.id,
            node_run_id: None,
            parent_span_id: None,
            kind: domain::RuntimeSpanKind::Flow,
            name: "debug flow".into(),
            status: domain::RuntimeSpanStatus::Running,
            capability_id: None,
            input_ref: None,
            output_ref: None,
            error_payload: None,
            metadata: json!({ "mode": "debug_flow_run" }),
            started_at,
            finished_at: None,
        },
    )
    .await
    .unwrap();

    let event = <PgControlPlaneStore as OrchestrationRuntimeRepository>::append_runtime_event(
        &store,
        &AppendRuntimeEventInput {
            flow_run_id: run.id,
            node_run_id: None,
            span_id: Some(span.id),
            parent_span_id: None,
            event_type: "run_started".into(),
            layer: domain::RuntimeEventLayer::RuntimeItem,
            source: domain::RuntimeEventSource::Host,
            trust_level: domain::RuntimeTrustLevel::HostFact,
            item_id: None,
            ledger_ref: None,
            payload: json!({ "run_id": run.id }),
            visibility: domain::RuntimeEventVisibility::Workspace,
            durability: domain::RuntimeEventDurability::Durable,
        },
    )
    .await
    .unwrap();

    let spans =
        <PgControlPlaneStore as OrchestrationRuntimeRepository>::list_runtime_spans(&store, run.id)
            .await
            .unwrap();
    let events = <PgControlPlaneStore as OrchestrationRuntimeRepository>::list_runtime_events(
        &store, run.id, 0,
    )
    .await
    .unwrap();

    assert_eq!(spans[0].id, span.id);
    assert_eq!(events[0].id, event.id);
    assert_eq!(events[0].sequence, 1);
    assert_eq!(events[0].trust_level, domain::RuntimeTrustLevel::HostFact);
}

#[tokio::test]
async fn orchestration_runtime_repository_persists_model_failover_attempt_ledger() {
    let pool = connect(&isolated_database_url().await).await.unwrap();
    run_migrations(&pool).await.unwrap();
    let store = PgControlPlaneStore::new(pool);
    let seeded = seed_runtime_base(&store).await;
    let compiled = seed_compiled_plan(&store, &seeded).await;
    let started_at = datetime!(2026-04-27 09:00:00 UTC);
    let run = seed_flow_run_with_mode(
        &store,
        &seeded,
        &compiled,
        started_at,
        FlowRunMode::DebugFlowRun,
        None,
    )
    .await;
    let node_run = seed_node_run(&store, &run, started_at).await;
    let span = <PgControlPlaneStore as OrchestrationRuntimeRepository>::append_runtime_span(
        &store,
        &AppendRuntimeSpanInput {
            flow_run_id: run.id,
            node_run_id: Some(node_run.id),
            parent_span_id: None,
            kind: domain::RuntimeSpanKind::LlmTurn,
            name: "LLM".into(),
            status: domain::RuntimeSpanStatus::Running,
            capability_id: None,
            input_ref: None,
            output_ref: None,
            error_payload: None,
            metadata: json!({}),
            started_at,
            finished_at: None,
        },
    )
    .await
    .unwrap();
    let attempt =
        <PgControlPlaneStore as OrchestrationRuntimeRepository>::append_model_failover_attempt_ledger(
            &store,
            &AppendModelFailoverAttemptLedgerInput {
                flow_run_id: run.id,
                node_run_id: Some(node_run.id),
                llm_turn_span_id: Some(span.id),
                queue_snapshot_id: None,
                attempt_index: 0,
                provider_instance_id: None,
                provider_code: "fixture_provider".into(),
                upstream_model_id: "gpt-5.4-mini".into(),
                protocol: "openai_compatible".into(),
                request_ref: Some("runtime_artifact:inline:req".into()),
                request_hash: Some("sha256:req".into()),
                started_at,
                first_token_at: None,
                finished_at: Some(started_at + Duration::seconds(1)),
                status: "succeeded".into(),
                failed_after_first_token: false,
                upstream_request_id: Some("req-1".into()),
                error_code: None,
                error_message_ref: None,
                usage_ledger_id: None,
                cost_ledger_id: None,
                response_ref: Some("runtime_artifact:inline:res".into()),
            },
        )
        .await
        .unwrap();
    let usage = <PgControlPlaneStore as OrchestrationRuntimeRepository>::append_usage_ledger(
        &store,
        &AppendUsageLedgerInput {
            flow_run_id: run.id,
            node_run_id: Some(node_run.id),
            span_id: Some(span.id),
            failover_attempt_id: Some(attempt.id),
            provider_instance_id: None,
            gateway_route_id: None,
            model_id: Some("gpt-5.4-mini".into()),
            upstream_model_id: Some("gpt-5.4-mini".into()),
            upstream_request_id: Some("req-1".into()),
            input_tokens: Some(1),
            cached_input_tokens: None,
            output_tokens: Some(2),
            reasoning_output_tokens: None,
            total_tokens: Some(3),
            cache_read_tokens: None,
            cache_write_tokens: None,
            price_snapshot: None,
            cost_snapshot: None,
            usage_status: domain::UsageLedgerStatus::Recorded,
            raw_usage: json!({ "total_tokens": 3 }),
            normalized_usage: json!({ "total_tokens": 3 }),
        },
    )
    .await
    .unwrap();
    <PgControlPlaneStore as OrchestrationRuntimeRepository>::link_usage_ledger_to_model_failover_attempt(
        &store,
        &LinkUsageLedgerToModelFailoverAttemptInput {
            failover_attempt_id: attempt.id,
            usage_ledger_id: usage.id,
        },
    )
    .await
    .unwrap();

    let attempts =
        <PgControlPlaneStore as OrchestrationRuntimeRepository>::list_model_failover_attempt_ledger(
            &store,
            run.id,
        )
        .await
        .unwrap();
    let usage_records =
        <PgControlPlaneStore as OrchestrationRuntimeRepository>::list_usage_ledger(&store, run.id)
            .await
            .unwrap();

    assert_eq!(attempts.len(), 1);
    assert_eq!(attempts[0].id, attempt.id);
    assert_eq!(attempts[0].usage_ledger_id, Some(usage.id));
    assert_eq!(usage_records[0].failover_attempt_id, Some(attempt.id));
}

#[tokio::test]
async fn credit_ledger_idempotency_prevents_double_debit() {
    let pool = connect(&isolated_database_url().await).await.unwrap();
    run_migrations(&pool).await.unwrap();
    let store = PgControlPlaneStore::new(pool);
    let workspace_id = seed_workspace(&store, "Billing").await;

    let first = <PgControlPlaneStore as OrchestrationRuntimeRepository>::append_credit_ledger(
        &store,
        &AppendCreditLedgerInput {
            workspace_id,
            user_id: None,
            app_id: None,
            agent_id: None,
            flow_run_id: None,
            span_id: None,
            cost_ledger_id: None,
            transaction_type: "debit".into(),
            amount: "3.50".into(),
            balance_after: Some("96.50".into()),
            credit_unit: "credit".into(),
            reason: "gateway_settle".into(),
            idempotency_key: "idem-1".into(),
            status: "posted".into(),
        },
    )
    .await
    .unwrap();

    let replay = <PgControlPlaneStore as OrchestrationRuntimeRepository>::append_credit_ledger(
        &store,
        &AppendCreditLedgerInput {
            workspace_id,
            idempotency_key: "idem-1".into(),
            amount: "3.50".into(),
            transaction_type: "debit".into(),
            credit_unit: "credit".into(),
            reason: "gateway_settle".into(),
            status: "posted".into(),
            user_id: None,
            app_id: None,
            agent_id: None,
            flow_run_id: None,
            span_id: None,
            cost_ledger_id: None,
            balance_after: Some("96.50".into()),
        },
    )
    .await
    .unwrap();

    assert_eq!(first.id, replay.id);
}

#[tokio::test]
async fn audit_hash_chain_links_runtime_facts() {
    let pool = connect(&isolated_database_url().await).await.unwrap();
    run_migrations(&pool).await.unwrap();
    let store = PgControlPlaneStore::new(pool);
    let seeded = seed_runtime_base(&store).await;
    let compiled = seed_compiled_plan(&store, &seeded).await;
    let run = seed_flow_run(
        &store,
        &seeded,
        &compiled,
        datetime!(2026-04-27 12:00:00 UTC),
    )
    .await;

    let first = store
        .append_audit_hash(
            run.id,
            "runtime_events",
            Uuid::now_v7(),
            serde_json::json!({"a":1}),
        )
        .await
        .unwrap();
    let second = store
        .append_audit_hash(
            run.id,
            "runtime_events",
            Uuid::now_v7(),
            serde_json::json!({"a":2}),
        )
        .await
        .unwrap();

    assert_eq!(second.prev_hash.as_deref(), Some(first.row_hash.as_str()));
}
