use control_plane::orchestration_runtime::{
    ContinueFlowDebugRunCommand, OrchestrationRuntimeService, StartFlowDebugRunCommand,
};
use control_plane::runtime_observability::coalesce_provider_stream_events;
use observability::{RuntimeBusEvent, RuntimeEventBus};
use plugin_framework::provider_contract::{ProviderMcpCall, ProviderStreamEvent, ProviderToolCall};
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

#[tokio::test]
async fn provider_tool_commit_is_recorded_as_intent_not_execution() {
    let service = OrchestrationRuntimeService::for_tests_with_provider_events(vec![
        ProviderStreamEvent::ToolCallCommit {
            call: ProviderToolCall {
                id: "call-1".into(),
                name: "lookup_order".into(),
                arguments: serde_json::json!({ "order_id": "A-1" }),
            },
        },
        ProviderStreamEvent::McpCallCommit {
            call: ProviderMcpCall {
                id: "mcp-1".into(),
                server: "orders".into(),
                method: "lookup".into(),
                arguments: serde_json::json!({ "order_id": "A-1" }),
            },
        },
    ]);
    let seeded = service.seed_application_with_flow("Support Agent").await;

    let started = service
        .start_flow_debug_run(StartFlowDebugRunCommand {
            actor_user_id: seeded.actor_user_id,
            application_id: seeded.application_id,
            input_payload: serde_json::json!({
                "node-start": { "query": "请查询订单" }
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

    let events = service.list_runtime_events(detail.flow_run.id, 0).await;
    let intents = events
        .iter()
        .filter(|event| {
            event.event_type == "capability_call_requested"
                && event.layer == domain::RuntimeEventLayer::Capability
        })
        .collect::<Vec<_>>();

    assert_eq!(intents.len(), 2);
    assert!(intents.iter().all(|event| {
        event.payload["provider_only_intent"] == serde_json::json!(true)
            && event.payload["requested_by"] == "model"
            && event.payload["call"]["arguments"]["order_id"] == "A-1"
    }));
    assert!(intents
        .iter()
        .any(|event| { event.payload["capability_id"] == "host_tool:model:lookup_order@runtime" }));
    assert!(intents
        .iter()
        .any(|event| { event.payload["capability_id"] == "mcp_tool:mcp:orders:lookup@runtime" }));
    assert!(!events.iter().any(|event| {
        event.layer == domain::RuntimeEventLayer::Capability
            && matches!(
                event.event_type.as_str(),
                "capability_call_executed" | "capability_call_completed"
            )
    }));
}

#[test]
fn provider_stream_events_are_coalesced_and_published_to_bus() {
    let bus = RuntimeEventBus::new(16);
    let mut receiver = bus.subscribe();

    let events = coalesce_provider_stream_events(
        &bus,
        &[
            ProviderStreamEvent::TextDelta {
                delta: "hel".into(),
            },
            ProviderStreamEvent::TextDelta { delta: "lo".into() },
            ProviderStreamEvent::ReasoningDelta {
                delta: "think".into(),
            },
            ProviderStreamEvent::Finish {
                reason: plugin_framework::provider_contract::ProviderFinishReason::Stop,
            },
        ],
        32,
    )
    .unwrap();

    assert_eq!(
        events[0],
        ProviderStreamEvent::TextDelta {
            delta: "hello".into()
        }
    );
    assert_eq!(
        events[1],
        ProviderStreamEvent::ReasoningDelta {
            delta: "think".into()
        }
    );
    assert_eq!(
        receiver.try_recv().unwrap(),
        RuntimeBusEvent::TextDelta {
            delta: "hello".into()
        }
    );
    assert_eq!(
        receiver.try_recv().unwrap(),
        RuntimeBusEvent::ReasoningDelta {
            delta: "think".into()
        }
    );
}

#[tokio::test]
async fn provider_text_deltas_are_coalesced_before_durable_write() {
    let service = OrchestrationRuntimeService::for_tests_with_provider_events(vec![
        ProviderStreamEvent::TextDelta {
            delta: "hel".into(),
        },
        ProviderStreamEvent::TextDelta { delta: "lo".into() },
        ProviderStreamEvent::UsageSnapshot {
            usage: plugin_framework::provider_contract::ProviderUsage {
                input_tokens: Some(1),
                output_tokens: Some(1),
                total_tokens: Some(2),
                ..Default::default()
            },
        },
        ProviderStreamEvent::Finish {
            reason: plugin_framework::provider_contract::ProviderFinishReason::Stop,
        },
    ]);
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

    let events = service.list_runtime_events(detail.flow_run.id, 0).await;
    let text_deltas = events
        .iter()
        .filter(|event| {
            event.event_type == "text_delta"
                && event.layer == domain::RuntimeEventLayer::ProviderRaw
        })
        .collect::<Vec<_>>();

    assert_eq!(text_deltas.len(), 1);
    assert_eq!(text_deltas[0].payload["delta"], "hello");
}
