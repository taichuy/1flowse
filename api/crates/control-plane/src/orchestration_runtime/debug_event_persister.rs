use anyhow::Result;
use serde_json::json;
use uuid::Uuid;

use crate::ports::{AppendRunEventInput, OrchestrationRuntimeRepository, RuntimeEventEnvelope};

pub async fn persist_debug_stream_events<R>(
    repository: &R,
    events: Vec<RuntimeEventEnvelope>,
) -> Result<()>
where
    R: OrchestrationRuntimeRepository,
{
    let mut run_events = Vec::new();
    let mut pending_delta: Option<PendingStreamDelta> = None;

    for event in events {
        if !event.persist_required {
            continue;
        }

        if is_stream_delta_event(&event.event_type) {
            let node_run_id = event
                .payload
                .get("node_run_id")
                .and_then(serde_json::Value::as_str)
                .and_then(|value| Uuid::parse_str(value).ok());
            let text = event
                .payload
                .get("text")
                .and_then(serde_json::Value::as_str)
                .unwrap_or_default();

            match &mut pending_delta {
                Some(pending)
                    if pending.run_id == event.run_id && pending.node_run_id == node_run_id =>
                {
                    if pending.event_type == event.event_type {
                        pending.text.push_str(text);
                    } else {
                        flush_pending_delta(&mut run_events, pending_delta.take());
                        pending_delta = Some(PendingStreamDelta {
                            run_id: event.run_id,
                            node_run_id,
                            event_type: event.event_type,
                            text: text.to_string(),
                        });
                    }
                }
                _ => {
                    flush_pending_delta(&mut run_events, pending_delta.take());
                    pending_delta = Some(PendingStreamDelta {
                        run_id: event.run_id,
                        node_run_id,
                        event_type: event.event_type,
                        text: text.to_string(),
                    });
                }
            }
            continue;
        }

        flush_pending_delta(&mut run_events, pending_delta.take());
        run_events.push(AppendRunEventInput {
            flow_run_id: event.run_id,
            node_run_id: None,
            event_type: event.event_type,
            payload: event.payload,
        });
    }

    flush_pending_delta(&mut run_events, pending_delta.take());
    if !run_events.is_empty() {
        repository.append_run_events(&run_events).await?;
    }

    Ok(())
}

fn is_stream_delta_event(event_type: &str) -> bool {
    event_type == "text_delta" || event_type == "reasoning_delta"
}

struct PendingStreamDelta {
    run_id: Uuid,
    node_run_id: Option<Uuid>,
    event_type: String,
    text: String,
}

fn flush_pending_delta(
    run_events: &mut Vec<AppendRunEventInput>,
    pending_delta: Option<PendingStreamDelta>,
) {
    let Some(pending) = pending_delta else {
        return;
    };

    run_events.push(AppendRunEventInput {
        flow_run_id: pending.run_id,
        node_run_id: pending.node_run_id,
        event_type: pending.event_type,
        payload: json!({ "text": pending.text }),
    });
}
