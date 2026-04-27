use plugin_framework::{
    installation::PluginTaskStatus,
    provider_contract::{
        ModelDiscoveryMode, ProviderInvocationResult, ProviderRuntimeError,
        ProviderRuntimeErrorKind, ProviderRuntimeLine, ProviderStdioMethod, ProviderStdioRequest,
        ProviderStdioResponse, ProviderStreamEvent, ProviderToolCall, ProviderUsage,
    },
};
use serde_json::json;

#[test]
fn model_discovery_mode_accepts_all_supported_wire_values() {
    assert_eq!(
        ModelDiscoveryMode::try_from("static").unwrap(),
        ModelDiscoveryMode::Static
    );
    assert_eq!(
        ModelDiscoveryMode::try_from("dynamic").unwrap(),
        ModelDiscoveryMode::Dynamic
    );
    assert_eq!(
        ModelDiscoveryMode::try_from("hybrid").unwrap(),
        ModelDiscoveryMode::Hybrid
    );
    assert!(ModelDiscoveryMode::try_from("unknown").is_err());
}

#[test]
fn provider_usage_total_tokens_falls_back_to_known_segments() {
    let usage = ProviderUsage {
        input_tokens: Some(120),
        output_tokens: Some(45),
        reasoning_tokens: Some(12),
        cache_read_tokens: Some(9),
        cache_write_tokens: Some(3),
        total_tokens: None,
    };

    assert_eq!(usage.total_tokens(), Some(189));
}

#[test]
fn provider_runtime_error_normalizes_common_vendor_failures() {
    let auth_failed = ProviderRuntimeError::normalize(
        "invalid_api_key",
        "401 unauthorized",
        Some("upstream rejected api key"),
    );
    assert_eq!(auth_failed.kind, ProviderRuntimeErrorKind::AuthFailed);

    let endpoint_unreachable =
        ProviderRuntimeError::normalize("upstream_timeout", "connect timeout", None);
    assert_eq!(
        endpoint_unreachable.kind,
        ProviderRuntimeErrorKind::EndpointUnreachable
    );

    let rate_limited = ProviderRuntimeError::normalize("quota_exceeded", "429", None);
    assert_eq!(rate_limited.kind, ProviderRuntimeErrorKind::RateLimited);

    let unknown = ProviderRuntimeError::normalize("unexpected_shape", "bad payload", None);
    assert_eq!(
        unknown.kind,
        ProviderRuntimeErrorKind::ProviderInvalidResponse
    );
}

#[test]
fn plugin_task_status_marks_only_terminal_states() {
    assert!(!PluginTaskStatus::Pending.is_terminal());
    assert!(!PluginTaskStatus::Running.is_terminal());
    assert!(PluginTaskStatus::Success.is_terminal());
    assert!(PluginTaskStatus::Failed.is_terminal());
    assert!(PluginTaskStatus::Canceled.is_terminal());
    assert!(PluginTaskStatus::TimedOut.is_terminal());
}

#[test]
fn provider_stdio_contract_uses_snake_case_methods_and_result_payloads() {
    let request = ProviderStdioRequest {
        method: ProviderStdioMethod::ListModels,
        input: json!({
            "api_key": "secret"
        }),
    };

    let request_payload = serde_json::to_value(&request).unwrap();
    assert_eq!(request_payload["method"], "list_models");
    assert_eq!(request_payload["input"]["api_key"], "secret");

    let response: ProviderStdioResponse = serde_json::from_value(json!({
        "ok": true,
        "result": [
            {
                "model_id": "fixture_dynamic"
            }
        ]
    }))
    .unwrap();
    assert!(response.ok);
    assert_eq!(response.result[0]["model_id"], "fixture_dynamic");
}

#[test]
fn provider_runtime_line_result_is_not_a_stream_event() {
    let line = ProviderRuntimeLine::Result {
        result: ProviderInvocationResult {
            final_content: Some("hello".into()),
            ..ProviderInvocationResult::default()
        },
    };

    assert_eq!(line.into_stream_event(), None);
}

#[test]
fn provider_runtime_line_text_maps_to_stream_event() {
    let line = ProviderRuntimeLine::TextDelta {
        delta: "hello".into(),
    };

    assert_eq!(
        line.into_stream_event(),
        Some(ProviderStreamEvent::TextDelta {
            delta: "hello".into()
        })
    );
}

#[test]
fn provider_runtime_line_tool_commit_preserves_arguments() {
    let line = ProviderRuntimeLine::ToolCallCommit {
        call: ProviderToolCall {
            id: "call-1".into(),
            name: "lookup_order".into(),
            arguments: json!({ "order_id": "A-1" }),
        },
    };

    match line.into_stream_event() {
        Some(ProviderStreamEvent::ToolCallCommit { call }) => {
            assert_eq!(call.arguments, json!({ "order_id": "A-1" }));
        }
        other => panic!("expected tool call commit stream event, got {other:?}"),
    }
}
