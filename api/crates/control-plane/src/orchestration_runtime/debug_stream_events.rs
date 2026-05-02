use crate::ports::{RuntimeEventDurability, RuntimeEventPayload, RuntimeEventSource};
use serde_json::json;
use uuid::Uuid;

pub fn flow_accepted(run_id: Uuid) -> RuntimeEventPayload {
    RuntimeEventPayload {
        event_type: "flow_accepted".to_string(),
        source: RuntimeEventSource::Runtime,
        durability: RuntimeEventDurability::Ephemeral,
        persist_required: false,
        trace_visible: false,
        payload: json!({
            "type": "flow_accepted",
            "run_id": run_id,
            "status": "queued"
        }),
    }
}

pub fn flow_started(run_id: Uuid) -> RuntimeEventPayload {
    RuntimeEventPayload {
        event_type: "flow_started".to_string(),
        source: RuntimeEventSource::Runtime,
        durability: RuntimeEventDurability::DurableRequired,
        persist_required: true,
        trace_visible: true,
        payload: json!({
            "type": "flow_started",
            "run_id": run_id,
            "status": "running"
        }),
    }
}

pub fn flow_finished(run_id: Uuid, output: serde_json::Value) -> RuntimeEventPayload {
    RuntimeEventPayload {
        event_type: "flow_finished".to_string(),
        source: RuntimeEventSource::Runtime,
        durability: RuntimeEventDurability::DurableRequired,
        persist_required: true,
        trace_visible: true,
        payload: json!({
            "type": "flow_finished",
            "run_id": run_id,
            "status": "succeeded",
            "output": output,
        }),
    }
}

pub fn flow_failed(run_id: Uuid, error_payload: serde_json::Value) -> RuntimeEventPayload {
    let error = error_payload
        .get("message")
        .and_then(|message| message.as_str())
        .map(ToString::to_string)
        .unwrap_or_else(|| {
            if error_payload.is_null() {
                "flow debug run failed".to_string()
            } else {
                error_payload.to_string()
            }
        });

    RuntimeEventPayload {
        event_type: "flow_failed".to_string(),
        source: RuntimeEventSource::Runtime,
        durability: RuntimeEventDurability::DurableRequired,
        persist_required: true,
        trace_visible: true,
        payload: json!({
            "type": "flow_failed",
            "run_id": run_id,
            "error": error,
            "error_payload": error_payload,
        }),
    }
}

pub fn node_started(node_run: &domain::NodeRunRecord) -> RuntimeEventPayload {
    RuntimeEventPayload {
        event_type: "node_started".to_string(),
        source: RuntimeEventSource::Runtime,
        durability: RuntimeEventDurability::DurableRequired,
        persist_required: true,
        trace_visible: true,
        payload: json!({
            "type": "node_started",
            "node_run_id": node_run.id,
            "node_id": node_run.node_id,
            "node_type": node_run.node_type,
            "title": node_run.node_alias,
            "input_payload": node_run.input_payload,
            "started_at": node_run.started_at,
        }),
    }
}

pub fn node_finished(node_run: &domain::NodeRunRecord) -> RuntimeEventPayload {
    RuntimeEventPayload {
        event_type: "node_finished".to_string(),
        source: RuntimeEventSource::Runtime,
        durability: RuntimeEventDurability::DurableRequired,
        persist_required: true,
        trace_visible: true,
        payload: json!({
            "type": "node_finished",
            "node_run_id": node_run.id,
            "node_id": node_run.node_id,
            "node_type": node_run.node_type,
            "status": node_run.status.as_str(),
            "output_payload": node_run.output_payload,
            "error_payload": node_run.error_payload,
            "metrics_payload": node_run.metrics_payload,
            "started_at": node_run.started_at,
            "finished_at": node_run.finished_at,
        }),
    }
}

pub fn text_delta(node_id: &str, node_run_id: Uuid, text: String) -> RuntimeEventPayload {
    RuntimeEventPayload {
        event_type: "text_delta".to_string(),
        source: RuntimeEventSource::Provider,
        durability: RuntimeEventDurability::DurableRequired,
        persist_required: true,
        trace_visible: false,
        payload: json!({
            "type": "text_delta",
            "node_run_id": node_run_id,
            "node_id": node_id,
            "text": text,
        }),
    }
}

pub fn heartbeat() -> RuntimeEventPayload {
    RuntimeEventPayload {
        event_type: "heartbeat".to_string(),
        source: RuntimeEventSource::System,
        durability: RuntimeEventDurability::Ephemeral,
        persist_required: false,
        trace_visible: false,
        payload: json!({ "type": "heartbeat" }),
    }
}
