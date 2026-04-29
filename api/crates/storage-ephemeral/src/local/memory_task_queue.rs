use std::{
    collections::{HashMap, VecDeque},
    sync::Arc,
};

use async_trait::async_trait;
use control_plane::ports::{ClaimedTask, TaskQueue};
use time::OffsetDateTime;
use tokio::sync::Mutex;
use uuid::Uuid;

#[derive(Clone)]
pub struct MemoryTaskQueue {
    namespace: String,
    inner: Arc<Mutex<TaskQueueState>>,
}

#[derive(Default)]
struct TaskQueueState {
    queues: HashMap<String, VecDeque<String>>,
    tasks: HashMap<String, TaskEntry>,
    idempotency_index: HashMap<(String, String), String>,
}

#[derive(Clone)]
struct TaskEntry {
    queue: String,
    task_id: String,
    payload: serde_json::Value,
    idempotency_key: Option<String>,
    claimed_by: Option<String>,
    claim_expires_at: Option<OffsetDateTime>,
}

impl MemoryTaskQueue {
    pub fn new(namespace: impl Into<String>) -> Self {
        Self {
            namespace: namespace.into(),
            inner: Arc::new(Mutex::new(TaskQueueState::default())),
        }
    }

    fn queue_key(&self, queue: &str) -> String {
        format!("{}:{}", self.namespace, queue)
    }

    fn claimed_task(entry: &TaskEntry) -> Option<ClaimedTask> {
        Some(ClaimedTask {
            task_id: entry.task_id.clone(),
            payload: entry.payload.clone(),
            claimed_by: entry.claimed_by.clone()?,
            idempotency_key: entry.idempotency_key.clone(),
            claim_expires_at_unix: entry.claim_expires_at?.unix_timestamp(),
        })
    }
}

#[async_trait]
impl TaskQueue for MemoryTaskQueue {
    async fn enqueue(
        &self,
        queue: &str,
        payload: serde_json::Value,
        idempotency_key: Option<&str>,
    ) -> anyhow::Result<String> {
        let queue_key = self.queue_key(queue);
        let idempotency_key = idempotency_key
            .filter(|value| !value.is_empty())
            .map(ToOwned::to_owned);
        let mut state = self.inner.lock().await;

        if let Some(idempotency_key) = &idempotency_key {
            let index_key = (queue_key.clone(), idempotency_key.clone());
            if let Some(task_id) = state.idempotency_index.get(&index_key).cloned() {
                if state.tasks.contains_key(&task_id) {
                    return Ok(task_id);
                }
                state.idempotency_index.remove(&index_key);
            }
        }

        let task_id = Uuid::now_v7().to_string();
        state
            .queues
            .entry(queue_key.clone())
            .or_default()
            .push_back(task_id.clone());
        if let Some(idempotency_key) = &idempotency_key {
            state.idempotency_index.insert(
                (queue_key.clone(), idempotency_key.clone()),
                task_id.clone(),
            );
        }
        state.tasks.insert(
            task_id.clone(),
            TaskEntry {
                queue: queue_key,
                task_id: task_id.clone(),
                payload,
                idempotency_key,
                claimed_by: None,
                claim_expires_at: None,
            },
        );

        Ok(task_id)
    }

    async fn claim(
        &self,
        queue: &str,
        worker: &str,
        visibility_timeout: time::Duration,
    ) -> anyhow::Result<Option<ClaimedTask>> {
        let queue_key = self.queue_key(queue);
        let mut state = self.inner.lock().await;
        let Some(task_ids) = state.queues.get(&queue_key).cloned() else {
            return Ok(None);
        };
        let now = OffsetDateTime::now_utc();

        for task_id in task_ids {
            let Some(entry) = state.tasks.get_mut(&task_id) else {
                continue;
            };
            let claim_is_active = entry
                .claim_expires_at
                .is_some_and(|deadline| deadline > now);
            if entry.claimed_by.is_some() && claim_is_active {
                continue;
            }

            entry.claimed_by = Some(worker.to_string());
            entry.claim_expires_at = Some(now + visibility_timeout);
            return Ok(Self::claimed_task(entry));
        }

        Ok(None)
    }

    async fn ack(&self, queue: &str, task_id: &str, worker: &str) -> anyhow::Result<bool> {
        let queue_key = self.queue_key(queue);
        let mut state = self.inner.lock().await;
        let now = OffsetDateTime::now_utc();
        let Some(entry) = state.tasks.get(task_id) else {
            return Ok(false);
        };

        if entry.queue != queue_key
            || entry.claimed_by.as_deref() != Some(worker)
            || entry
                .claim_expires_at
                .is_none_or(|deadline| deadline <= now)
        {
            return Ok(false);
        }

        let entry = state
            .tasks
            .remove(task_id)
            .expect("task existence checked before removal");
        if let Some(task_ids) = state.queues.get_mut(&entry.queue) {
            task_ids.retain(|queued_task_id| queued_task_id != task_id);
        }
        if let Some(idempotency_key) = entry.idempotency_key {
            state
                .idempotency_index
                .remove(&(entry.queue, idempotency_key));
        }

        Ok(true)
    }

    async fn fail(
        &self,
        queue: &str,
        task_id: &str,
        worker: &str,
        _reason: &str,
    ) -> anyhow::Result<bool> {
        let queue_key = self.queue_key(queue);
        let mut state = self.inner.lock().await;
        let Some(entry) = state.tasks.get_mut(task_id) else {
            return Ok(false);
        };
        if entry.queue != queue_key || entry.claimed_by.as_deref() != Some(worker) {
            return Ok(false);
        }

        entry.claimed_by = None;
        entry.claim_expires_at = None;
        Ok(true)
    }
}
