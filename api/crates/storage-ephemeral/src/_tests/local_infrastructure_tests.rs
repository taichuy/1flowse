use control_plane::ports::{DistributedLock, EventBus, TaskQueue};
use serde_json::json;
use storage_ephemeral::{MemoryDistributedLock, MemoryEventBus, MemoryTaskQueue};
use time::Duration;

#[tokio::test]
async fn memory_distributed_lock_checks_owner() {
    let lock = MemoryDistributedLock::new("flowbase:lock");

    assert!(lock
        .acquire("install", "owner-a", Duration::seconds(30))
        .await
        .unwrap());
    assert!(!lock.release("install", "owner-b").await.unwrap());
    assert!(lock.release("install", "owner-a").await.unwrap());
}

#[tokio::test]
async fn memory_event_bus_delivers_by_topic_in_fifo_order() {
    let bus = MemoryEventBus::new();

    bus.publish("plugin.install", json!({ "id": 1 }))
        .await
        .unwrap();
    bus.publish("plugin.install", json!({ "id": 2 }))
        .await
        .unwrap();
    bus.publish("runtime.debug", json!({ "id": 3 }))
        .await
        .unwrap();

    assert_eq!(bus.poll("other").await.unwrap(), None);
    assert_eq!(
        bus.poll("plugin.install").await.unwrap(),
        Some(json!({ "id": 1 }))
    );
    assert_eq!(
        bus.poll("plugin.install").await.unwrap(),
        Some(json!({ "id": 2 }))
    );
    assert_eq!(
        bus.poll("runtime.debug").await.unwrap(),
        Some(json!({ "id": 3 }))
    );
}

#[tokio::test]
async fn memory_task_queue_idempotency_claim_ack_and_fail_are_worker_checked() {
    let queue = MemoryTaskQueue::new("flowbase:task");

    let task_id = queue
        .enqueue("preview", json!({ "file": "a" }), Some("preview:file:a"))
        .await
        .unwrap();
    let repeated_task_id = queue
        .enqueue("preview", json!({ "file": "a" }), Some("preview:file:a"))
        .await
        .unwrap();
    assert_eq!(repeated_task_id, task_id);

    let task = queue
        .claim("preview", "worker-a", Duration::seconds(30))
        .await
        .unwrap()
        .unwrap();

    assert_eq!(task.task_id, task_id);
    assert_eq!(task.idempotency_key.as_deref(), Some("preview:file:a"));
    assert!(task.claim_expires_at_unix > time::OffsetDateTime::now_utc().unix_timestamp());
    assert!(!queue.ack("preview", &task_id, "worker-b").await.unwrap());
    assert!(queue
        .fail("preview", &task_id, "worker-a", "retry")
        .await
        .unwrap());

    let reclaimed = queue
        .claim("preview", "worker-b", Duration::seconds(30))
        .await
        .unwrap()
        .unwrap();
    assert_eq!(reclaimed.task_id, task_id);
    assert_eq!(reclaimed.claimed_by, "worker-b");
    assert!(queue.ack("preview", &task_id, "worker-b").await.unwrap());
}

#[tokio::test]
async fn memory_task_queue_reclaims_after_visibility_timeout() {
    let queue = MemoryTaskQueue::new("flowbase:task");
    let task_id = queue
        .enqueue("preview", json!({ "file": "b" }), Some("preview:file:b"))
        .await
        .unwrap();

    assert!(queue
        .claim("preview", "worker-a", Duration::milliseconds(30))
        .await
        .unwrap()
        .is_some());
    assert!(queue
        .claim("preview", "worker-b", Duration::seconds(30))
        .await
        .unwrap()
        .is_none());

    tokio::time::sleep(std::time::Duration::from_millis(80)).await;

    let reclaimed = queue
        .claim("preview", "worker-b", Duration::seconds(30))
        .await
        .unwrap()
        .unwrap();
    assert_eq!(reclaimed.task_id, task_id);
    assert_eq!(reclaimed.claimed_by, "worker-b");
    assert!(!queue.ack("preview", &task_id, "worker-a").await.unwrap());
    assert!(queue.ack("preview", &task_id, "worker-b").await.unwrap());
}
