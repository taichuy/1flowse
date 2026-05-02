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
        if sender.send(runtime_event_to_sse(event)).await.is_err() {
            return;
        }
    }

    while let Some(event) = subscription.live_events.recv().await {
        if sender.send(runtime_event_to_sse(event)).await.is_err() {
            return;
        }
    }
}
