use control_plane::orchestration_runtime::{
    ContinueFlowDebugRunCommand, OrchestrationRuntimeService, StartFlowDebugRunCommand,
    StartNodeDebugPreviewCommand,
};
use time::Duration;
use uuid::Uuid;

#[tokio::test]
async fn start_node_debug_preview_creates_run_node_run_and_events() {
    let service = OrchestrationRuntimeService::for_tests();
    let seeded = service.seed_application_with_flow("Support Agent").await;

    let outcome = service
        .start_node_debug_preview(StartNodeDebugPreviewCommand {
            actor_user_id: seeded.actor_user_id,
            application_id: seeded.application_id,
            node_id: "node-llm".to_string(),
            input_payload: serde_json::json!({
                "node-start": { "query": "请总结退款政策" }
            }),
            document_snapshot: None,
        })
        .await
        .unwrap();

    assert_eq!(outcome.flow_run.status, domain::FlowRunStatus::Succeeded);
    assert_eq!(outcome.node_run.status, domain::NodeRunStatus::Succeeded);
    assert!(outcome
        .events
        .iter()
        .any(|event| event.event_type == "node_preview_completed"));
}

#[tokio::test]
async fn start_node_debug_preview_uses_selected_source_provider_instance() {
    let service = OrchestrationRuntimeService::for_tests();
    let seeded = service
        .seed_application_with_multi_instance_provider_flow("Support Agent")
        .await;

    let outcome = service
        .start_node_debug_preview(StartNodeDebugPreviewCommand {
            actor_user_id: seeded.actor_user_id,
            application_id: seeded.application_id,
            node_id: "node-llm".to_string(),
            input_payload: serde_json::json!({
                "node-start": { "query": "请总结退款政策" }
            }),
            document_snapshot: None,
        })
        .await
        .unwrap();

    assert_eq!(
        outcome.preview_payload["metrics_payload"]["provider_instance_id"],
        serde_json::json!(seeded.source_provider_instance_id.to_string())
    );
}

#[tokio::test]
async fn start_node_debug_preview_uses_request_document_snapshot() {
    let service = OrchestrationRuntimeService::for_tests();
    let seeded = service.seed_application_with_flow("Support Agent").await;

    let outcome = service
        .start_node_debug_preview(StartNodeDebugPreviewCommand {
            actor_user_id: seeded.actor_user_id,
            application_id: seeded.application_id,
            node_id: "node-llm".to_string(),
            input_payload: serde_json::json!({
                "node-start": { "query": "draft prompt" }
            }),
            document_snapshot: Some(serde_json::json!({
                "schemaVersion": "1flowbase.flow/v1",
                "meta": {
                    "flowId": seeded.flow_id.to_string(),
                    "name": "Support Agent",
                    "description": "",
                    "tags": []
                },
                "graph": {
                    "nodes": [
                        {
                            "id": "node-start",
                            "type": "start",
                            "alias": "Start",
                            "description": "",
                            "containerId": null,
                            "position": { "x": 0, "y": 0 },
                            "configVersion": 1,
                            "config": {},
                            "bindings": {},
                            "outputs": [{ "key": "query", "title": "用户输入", "valueType": "string" }]
                        },
                        {
                            "id": "node-llm",
                            "type": "llm",
                            "alias": "LLM",
                            "description": "",
                            "containerId": null,
                            "position": { "x": 240, "y": 0 },
                            "configVersion": 1,
                            "config": {
                                "model_provider": {
                                    "provider_code": "fixture_provider",
                                    "source_instance_id": seeded.source_provider_instance_id.to_string(),
                                    "model_id": "gpt-5.4-mini"
                                }
                            },
                            "bindings": {
                                "user_prompt": { "kind": "templated_text", "value": "snapshot {{node-start.query}}" }
                            },
                            "outputs": [{ "key": "text", "title": "模型输出", "valueType": "string" }]
                        }
                    ],
                    "edges": [
                        {
                            "id": "edge-start-llm",
                            "source": "node-start",
                            "target": "node-llm",
                            "sourceHandle": null,
                            "targetHandle": null,
                            "containerId": null,
                            "points": []
                        }
                    ]
                },
                "editor": {
                    "viewport": { "x": 0, "y": 0, "zoom": 1 },
                    "annotations": [],
                    "activeContainerPath": []
                }
            })),
        })
        .await
        .unwrap();

    assert_eq!(
        outcome.preview_payload["node_output"]["text"],
        serde_json::json!("echo:gpt-5.4-mini:snapshot draft prompt")
    );
}

#[tokio::test]
async fn start_node_debug_preview_records_provider_invocation_duration() {
    let service = OrchestrationRuntimeService::for_tests_with_provider_delay(
        std::time::Duration::from_millis(50),
    );
    let seeded = service.seed_application_with_flow("Support Agent").await;

    let outcome = service
        .start_node_debug_preview(StartNodeDebugPreviewCommand {
            actor_user_id: seeded.actor_user_id,
            application_id: seeded.application_id,
            node_id: "node-llm".to_string(),
            input_payload: serde_json::json!({
                "node-start": { "query": "请总结退款政策" }
            }),
            document_snapshot: None,
        })
        .await
        .unwrap();

    let elapsed = outcome
        .node_run
        .finished_at
        .expect("node preview should finish")
        - outcome.node_run.started_at;

    assert!(elapsed >= Duration::milliseconds(45));
}

#[tokio::test]
async fn start_flow_debug_run_returns_running_detail_before_background_continuation() {
    let service = OrchestrationRuntimeService::for_tests();
    let seeded = service
        .seed_application_with_plugin_node_flow("Capability Agent")
        .await;

    let started = service
        .start_flow_debug_run(StartFlowDebugRunCommand {
            actor_user_id: seeded.actor_user_id,
            application_id: seeded.application_id,
            input_payload: serde_json::json!({
                "node-start": { "query": "world" }
            }),
            document_snapshot: None,
        })
        .await
        .unwrap();

    assert_eq!(started.flow_run.status, domain::FlowRunStatus::Running);
    assert!(started.node_runs.is_empty());
    assert_eq!(started.events[0].event_type, "flow_run_started");
}

#[tokio::test]
async fn start_flow_debug_run_records_gateway_billing_audit_trace() {
    let service = OrchestrationRuntimeService::for_tests();
    let seeded = service
        .seed_application_with_plugin_node_flow("Capability Agent")
        .await;

    let started = service
        .start_flow_debug_run(StartFlowDebugRunCommand {
            actor_user_id: seeded.actor_user_id,
            application_id: seeded.application_id,
            input_payload: serde_json::json!({
                "node-start": { "query": "world" }
            }),
            document_snapshot: None,
        })
        .await
        .unwrap();

    let billing_event = started
        .events
        .iter()
        .find(|event| event.event_type == "gateway_billing_session_reserved")
        .expect("gateway billing event should be recorded before continuation");

    assert_eq!(
        billing_event.payload["billing_session"]["status"].as_str(),
        Some("reserved")
    );
    assert_eq!(
        billing_event.payload["cost_ledger"]["cost_status"].as_str(),
        Some("pending_usage")
    );
    assert_eq!(
        billing_event.payload["credit_ledger"]["transaction_type"].as_str(),
        Some("reserve")
    );
    assert_eq!(
        billing_event.payload["route_trace"]["trust_level"].as_str(),
        Some("host_fact")
    );
    assert_eq!(
        billing_event.payload["audit_hashes"]
            .as_array()
            .map(|hashes| hashes.len()),
        Some(3)
    );
}

#[tokio::test]
async fn continue_flow_debug_run_executes_plugin_node_through_capability_runtime() {
    let service = OrchestrationRuntimeService::for_tests();
    let seeded = service
        .seed_application_with_plugin_node_flow("Capability Agent")
        .await;

    let started = service
        .start_flow_debug_run(StartFlowDebugRunCommand {
            actor_user_id: seeded.actor_user_id,
            application_id: seeded.application_id,
            input_payload: serde_json::json!({
                "node-start": { "query": "world" }
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

    assert_eq!(detail.flow_run.status, domain::FlowRunStatus::Succeeded);
    assert_eq!(detail.node_runs[1].node_type, "plugin_node");
    assert_eq!(detail.node_runs[1].output_payload["answer"], "world");
}
