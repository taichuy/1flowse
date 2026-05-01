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
