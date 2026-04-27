use observability::DebugStreamPart;

pub fn fold_event_to_debug_part(
    flow_run_id: uuid::Uuid,
    event: &domain::RuntimeEventRecord,
) -> Option<DebugStreamPart> {
    let part_type = match event.event_type.as_str() {
        "text_delta" => "text",
        "reasoning_delta" => "reasoning",
        "tool_call_commit" | "capability_call_requested" => "tool_input",
        "tool_result_appended" | "capability_call_finished" => "tool_output",
        "approval_requested" | "approval_resolved" => "approval",
        "handoff" => "handoff",
        "usage_snapshot" | "usage_recorded" => "usage_snapshot",
        "cost_recorded" | "credit_debited" | "credit_refunded" => "ledger_ref",
        "error" | "run_failed" | "llm_turn_failed" => "error",
        _ => "data",
    };

    Some(DebugStreamPart {
        id: event.id,
        flow_run_id,
        item_id: event.item_id,
        span_id: event.span_id,
        part_type: part_type.to_string(),
        status: "created".to_string(),
        trust_level: event.trust_level,
        payload: serde_json::json!({
            "event_type": event.event_type,
            "layer": event.layer.as_str(),
            "source": event.source.as_str(),
            "payload": event.payload,
        }),
    })
}
