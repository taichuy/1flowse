use control_plane::orchestration_runtime::{
    ContinueFlowDebugRunCommand, OrchestrationRuntimeService, StartFlowDebugRunCommand,
};
use uuid::Uuid;

#[tokio::test]
async fn flow_debug_run_shadow_writes_runtime_spans_and_provider_events() {
    let service = OrchestrationRuntimeService::for_tests();
    let seeded = service.seed_application_with_flow("Support Agent").await;

    let started = service
        .start_flow_debug_run(StartFlowDebugRunCommand {
            actor_user_id: seeded.actor_user_id,
            application_id: seeded.application_id,
            input_payload: serde_json::json!({
                "node-start": { "query": "请总结退款政策" }
            }),
            document_snapshot: None,
        })
        .await
        .unwrap();
    let detail = service
        .continue_flow_debug_run(ContinueFlowDebugRunCommand {
            application_id: seeded.application_id,
            flow_run_id: started.flow_run.id,
            workspace_id: Uuid::nil(),
        })
        .await
        .unwrap();

    let spans = service.list_runtime_spans(detail.flow_run.id).await;
    let events = service.list_runtime_events(detail.flow_run.id, 0).await;

    assert!(spans
        .iter()
        .any(|span| span.kind == domain::RuntimeSpanKind::Flow));
    assert!(spans
        .iter()
        .any(|span| span.kind == domain::RuntimeSpanKind::LlmTurn));
    assert!(events.iter().any(|event| event.event_type == "text_delta"));
    assert!(events
        .iter()
        .any(|event| event.layer == domain::RuntimeEventLayer::ProviderRaw));
}
