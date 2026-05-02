use std::time::Duration;

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

fn required_text_delta(index: usize) -> RuntimeEventPayload {
    RuntimeEventPayload {
        event_type: "text_delta".to_string(),
        source: RuntimeEventSource::Provider,
        durability: RuntimeEventDurability::DurableRequired,
        persist_required: true,
        trace_visible: true,
        payload: json!({ "index": index }),
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
async fn local_runtime_event_stream_overflow_preserves_required_events() {
    let stream = LocalRuntimeEventStream::new();
    let run_id = Uuid::now_v7();
    let policy = RuntimeEventStreamPolicy {
        max_events: 3,
        ..RuntimeEventStreamPolicy::debug_default()
    };

    stream.open_run(run_id, policy).await.unwrap();
    stream.append(run_id, heartbeat()).await.unwrap();
    stream.append(run_id, required_text_delta(1)).await.unwrap();
    stream.append(run_id, heartbeat()).await.unwrap();
    stream.append(run_id, required_text_delta(2)).await.unwrap();
    stream.append(run_id, heartbeat()).await.unwrap();

    let replay = stream.replay(run_id, Some(1), 10).await.unwrap();
    let sequences = replay
        .iter()
        .map(|event| event.sequence)
        .collect::<Vec<_>>();

    assert!(sequences.contains(&2));
    assert!(sequences.contains(&4));
    assert!(!sequences.contains(&3));
}

#[tokio::test]
async fn local_runtime_event_stream_trim_keep_required_preserves_required_events() {
    let stream = LocalRuntimeEventStream::new();
    let run_id = Uuid::now_v7();

    stream
        .open_run(run_id, RuntimeEventStreamPolicy::debug_default())
        .await
        .unwrap();
    stream.append(run_id, heartbeat()).await.unwrap();
    stream.append(run_id, required_text_delta(1)).await.unwrap();
    stream.append(run_id, heartbeat()).await.unwrap();

    stream
        .trim(
            run_id,
            RuntimeEventTrimPolicy {
                before_sequence: Some(4),
                keep_required: true,
            },
        )
        .await
        .unwrap();

    let replay = stream.replay(run_id, Some(1), 10).await.unwrap();
    assert_eq!(replay.len(), 1);
    assert_eq!(replay[0].sequence, 2);
    assert!(replay[0].persist_required);
}

#[tokio::test]
async fn local_runtime_event_stream_backfills_retained_events_after_live_lag() {
    let stream = LocalRuntimeEventStream::with_broadcast_capacity_for_tests(1);
    let run_id = Uuid::now_v7();
    let policy = RuntimeEventStreamPolicy {
        max_events: 10,
        ..RuntimeEventStreamPolicy::debug_default()
    };

    stream.open_run(run_id, policy).await.unwrap();
    let mut subscription = stream.subscribe(run_id, Some(0)).await.unwrap();
    assert!(subscription.replay.is_empty());

    for index in 0..5 {
        stream
            .append(run_id, required_text_delta(index))
            .await
            .unwrap();
    }

    let mut sequences = Vec::new();
    for _ in 0..5 {
        let event = tokio::time::timeout(Duration::from_secs(1), subscription.live_events.recv())
            .await
            .unwrap()
            .unwrap();
        sequences.push(event.sequence);
    }

    assert_eq!(sequences, vec![1, 2, 3, 4, 5]);
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
