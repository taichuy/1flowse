use std::{convert::Infallible, sync::Arc};

use axum::response::sse::Event;
use control_plane::ports::{RuntimeEventEnvelope, RuntimeEventStream};
use tokio::sync::mpsc;
use uuid::Uuid;

pub type DebugRunSseStream = tokio_stream::wrappers::ReceiverStream<Result<Event, Infallible>>;

pub fn runtime_event_to_sse(envelope: RuntimeEventEnvelope) -> Result<Event, Infallible> {
    Ok(Event::default()
        .id(envelope.sequence.to_string())
        .event(envelope.event_type)
        .json_data(envelope.payload)
        .expect("runtime event payload should serialize"))
}

fn is_terminal_runtime_event(event_type: &str) -> bool {
    matches!(event_type, "flow_finished" | "flow_failed")
}

pub async fn send_runtime_event_stream(
    stream: Arc<dyn RuntimeEventStream>,
    run_id: Uuid,
    from_sequence: Option<i64>,
    sender: mpsc::Sender<Result<Event, Infallible>>,
) {
    let Ok(mut subscription) = stream.subscribe(run_id, from_sequence).await else {
        let _ = sender
            .send(Ok(Event::default()
                .event("replay_expired")
                .json_data(serde_json::json!({ "type": "replay_expired" }))
                .expect("replay_expired payload should serialize")))
            .await;
        return;
    };

    for event in subscription.replay {
        let is_terminal = is_terminal_runtime_event(&event.event_type);
        if sender.send(runtime_event_to_sse(event)).await.is_err() {
            return;
        }
        if is_terminal {
            return;
        }
    }

    while let Some(event) = subscription.live_events.recv().await {
        let is_terminal = is_terminal_runtime_event(&event.event_type);
        if sender.send(runtime_event_to_sse(event)).await.is_err() {
            return;
        }
        if is_terminal {
            return;
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use control_plane::ports::{
        RuntimeEventDurability, RuntimeEventPayload, RuntimeEventSource, RuntimeEventStreamPolicy,
    };
    use serde_json::json;
    use tokio::time::{timeout, Duration};

    use crate::host_infrastructure::LocalRuntimeEventStream;

    fn runtime_event(event_type: &str) -> RuntimeEventPayload {
        RuntimeEventPayload {
            event_type: event_type.to_string(),
            source: RuntimeEventSource::Runtime,
            durability: RuntimeEventDurability::DurableRequired,
            persist_required: true,
            trace_visible: true,
            payload: json!({ "type": event_type }),
        }
    }

    #[tokio::test]
    async fn send_runtime_event_stream_returns_after_terminal_event() {
        let stream = Arc::new(LocalRuntimeEventStream::new());
        let run_id = Uuid::now_v7();
        stream
            .open_run(run_id, RuntimeEventStreamPolicy::debug_default())
            .await
            .unwrap();
        let (sender, mut receiver) = mpsc::channel(8);

        tokio::spawn(send_runtime_event_stream(
            stream.clone(),
            run_id,
            None,
            sender,
        ));
        stream
            .append(run_id, runtime_event("flow_finished"))
            .await
            .unwrap();

        let _ = timeout(Duration::from_secs(1), receiver.recv())
            .await
            .expect("terminal event should be sent")
            .expect("terminal event should be available")
            .expect("sse event should be valid");

        let closed = timeout(Duration::from_millis(100), receiver.recv()).await;
        assert!(
            matches!(closed, Ok(None)),
            "sender should close after terminal event"
        );
    }
}
