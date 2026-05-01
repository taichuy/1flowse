use control_plane::ports::{
    RuntimeEventCloseReason, RuntimeEventDurability, RuntimeEventPayload, RuntimeEventSource,
    RuntimeEventStream, RuntimeEventStreamPolicy, RuntimeEventTrimPolicy,
};
use serde_json::json;
use uuid::Uuid;

use crate::host_infrastructure::LocalRuntimeEventStream;

fn heartbeat() -> RuntimeEventPayload {
    RuntimeEventPayload {
        event_type: "heartbeat".to_string(),
        source: RuntimeEventSource::System,
        durability: RuntimeEventDurability::Ephemeral,
        persist_required: false,
        trace_visible: false,
        payload: json!({ "type": "heartbeat" }),
    }
}

#[tokio::test]
async fn local_runtime_event_stream_assigns_monotonic_sequence() {
    let stream = LocalRuntimeEventStream::new();
    let run_id = Uuid::now_v7();

    stream
        .open_run(run_id, RuntimeEventStreamPolicy::debug_default())
        .await
        .unwrap();
    let first = stream.append(run_id, heartbeat()).await.unwrap();
    let second = stream.append(run_id, heartbeat()).await.unwrap();

    assert_eq!(first.sequence, 1);
    assert_eq!(second.sequence, 2);
    assert_ne!(first.event_id, second.event_id);
}

#[tokio::test]
async fn local_runtime_event_stream_replays_then_subscribes_live() {
    let stream = LocalRuntimeEventStream::new();
    let run_id = Uuid::now_v7();

    stream
        .open_run(run_id, RuntimeEventStreamPolicy::debug_default())
        .await
        .unwrap();
    stream.append(run_id, heartbeat()).await.unwrap();
    let mut subscription = stream.subscribe(run_id, Some(0)).await.unwrap();
    stream.append(run_id, heartbeat()).await.unwrap();

    assert_eq!(subscription.replay.len(), 1);
    assert_eq!(subscription.replay[0].sequence, 1);
    let live = subscription.live_events.recv().await.unwrap();
    assert_eq!(live.sequence, 2);
}

#[tokio::test]
async fn local_runtime_event_stream_reports_replay_expired_after_trim() {
    let stream = LocalRuntimeEventStream::new();
    let run_id = Uuid::now_v7();

    stream
        .open_run(run_id, RuntimeEventStreamPolicy::debug_default())
        .await
        .unwrap();
    stream.append(run_id, heartbeat()).await.unwrap();
    stream
        .trim(
            run_id,
            RuntimeEventTrimPolicy {
                before_sequence: Some(2),
                keep_required: false,
            },
        )
        .await
        .unwrap();

    let err = match stream.subscribe(run_id, Some(0)).await {
        Ok(_) => panic!("expected replay expired error"),
        Err(err) => err,
    };
    assert!(err.to_string().contains("runtime event replay expired"));
}

#[tokio::test]
async fn local_runtime_event_stream_rejects_append_after_close() {
    let stream = LocalRuntimeEventStream::new();
    let run_id = Uuid::now_v7();

    stream
        .open_run(run_id, RuntimeEventStreamPolicy::debug_default())
        .await
        .unwrap();
    stream
        .close_run(run_id, RuntimeEventCloseReason::Finished)
        .await
        .unwrap();

    let err = stream.append(run_id, heartbeat()).await.unwrap_err();
    assert!(err.to_string().contains("runtime event stream is closed"));
}
