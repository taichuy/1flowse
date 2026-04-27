use control_plane::orchestration_runtime::{
    ContinueFlowDebugRunCommand, OrchestrationRuntimeService, StartFlowDebugRunCommand,
};
use control_plane::runtime_observability::{coalesce_provider_stream_events, item_kind_for_event};
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

#[tokio::test]
async fn llm_turn_records_context_projection_and_usage_ledger() {
    let service = OrchestrationRuntimeService::for_tests_with_provider_events(vec![
        ProviderStreamEvent::TextDelta {
            delta: "hello".into(),
        },
        ProviderStreamEvent::UsageSnapshot {
            usage: plugin_framework::provider_contract::ProviderUsage {
                input_tokens: Some(9),
                cache_read_tokens: Some(3),
                output_tokens: Some(2),
                reasoning_tokens: Some(1),
                total_tokens: Some(12),
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

    let projections = service.list_context_projections(detail.flow_run.id).await;
    let usage = service.list_usage_ledger(detail.flow_run.id).await;

    assert_eq!(projections.len(), 1);
    assert_eq!(projections[0].projection_kind, "managed_full");
    assert!(projections[0].model_input_hash.starts_with("sha256:"));
    assert_eq!(
        projections[0].model_input_ref,
        format!(
            "runtime_artifact:inline:{}",
            projections[0].model_input_hash
        )
    );
    assert_eq!(usage.len(), 1);
    assert_eq!(usage[0].input_tokens, Some(9));
    assert_eq!(usage[0].cache_read_tokens, Some(3));
    assert_eq!(usage[0].usage_status, domain::UsageLedgerStatus::Recorded);
}

#[tokio::test]
async fn provider_events_fold_into_runtime_items() {
    let service = OrchestrationRuntimeService::for_tests_with_provider_events(vec![
        ProviderStreamEvent::TextDelta {
            delta: "hello".into(),
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

    let items = service.list_runtime_items(detail.flow_run.id).await;

    assert!(items
        .iter()
        .any(|item| item.kind == domain::RuntimeItemKind::Message));
    assert!(items
        .iter()
        .any(|item| item.trust_level == domain::RuntimeTrustLevel::HostFact));
    assert_eq!(
        item_kind_for_event("capability_call_requested"),
        None,
        "capability request events must not be folded into runtime items"
    );
}

#[tokio::test]
async fn tool_call_commit_creates_capability_invocation_request() {
    let service = OrchestrationRuntimeService::for_tests_with_provider_events(vec![
        ProviderStreamEvent::ToolCallCommit {
            call: ProviderToolCall {
                id: "call-1".into(),
                name: "lookup_order".into(),
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

    let invocations = service
        .list_capability_invocations(detail.flow_run.id)
        .await;

    assert_eq!(invocations.len(), 1);
    assert_eq!(
        invocations[0].capability_id,
        "host_tool:model:lookup_order@runtime"
    );
    assert_eq!(invocations[0].authorization_status, "requested");
    assert_eq!(invocations[0].requester_kind, "model");
    assert!(invocations[0]
        .arguments_ref
        .as_deref()
        .is_some_and(|value| value.starts_with("runtime_artifact:inline:")));
}

#[test]
fn capability_ids_are_canonical_across_sources() {
    assert_eq!(
        control_plane::capability_runtime::host_tool_capability_id("search"),
        "host_tool:model:search@runtime"
    );
    assert_eq!(
        control_plane::capability_runtime::mcp_tool_capability_id("github", "create_issue"),
        "mcp_tool:mcp:github:create_issue@runtime"
    );
    assert_eq!(
        control_plane::capability_runtime::skill_action_capability_id(
            "builtin", "coding", "review", "1"
        ),
        "skill_action:builtin:coding:review@1"
    );
    assert_eq!(
        control_plane::capability_runtime::workflow_tool_capability_id("app-1", "flow-1", "3"),
        "workflow_tool:app-1:flow-1@3"
    );
    assert_eq!(
        control_plane::capability_runtime::approval_capability_id("policy-1", "2"),
        "approval:policy:policy-1@2"
    );
    assert_eq!(
        control_plane::capability_runtime::subagent_capability_id("builtin", "reviewer", "1"),
        "system_agent:builtin:reviewer@1"
    );
}
