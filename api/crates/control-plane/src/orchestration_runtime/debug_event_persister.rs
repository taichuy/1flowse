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
    let mut pending_text: Option<PendingTextDelta> = None;

    for event in events {
        if !event.persist_required {
            continue;
        }

        if event.event_type == "text_delta" {
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

            match &mut pending_text {
                Some(pending)
                    if pending.run_id == event.run_id && pending.node_run_id == node_run_id =>
                {
                    pending.text.push_str(text);
                }
                _ => {
                    flush_pending_text(&mut run_events, pending_text.take());
                    pending_text = Some(PendingTextDelta {
                        run_id: event.run_id,
                        node_run_id,
                        text: text.to_string(),
                    });
                }
            }
            continue;
        }

        flush_pending_text(&mut run_events, pending_text.take());
        run_events.push(AppendRunEventInput {
            flow_run_id: event.run_id,
            node_run_id: None,
            event_type: event.event_type,
            payload: event.payload,
        });
    }

    flush_pending_text(&mut run_events, pending_text.take());
    if !run_events.is_empty() {
        repository.append_run_events(&run_events).await?;
    }

    Ok(())
}

struct PendingTextDelta {
    run_id: Uuid,
    node_run_id: Option<Uuid>,
    text: String,
}

fn flush_pending_text(
    run_events: &mut Vec<AppendRunEventInput>,
    pending_text: Option<PendingTextDelta>,
) {
    let Some(pending) = pending_text else {
        return;
    };

    run_events.push(AppendRunEventInput {
        flow_run_id: pending.run_id,
        node_run_id: pending.node_run_id,
        event_type: "text_delta".to_string(),
        payload: json!({ "text": pending.text }),
    });
}
