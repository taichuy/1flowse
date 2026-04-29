use std::{
    collections::{HashMap, VecDeque},
    sync::Arc,
};

use async_trait::async_trait;
use control_plane::ports::EventBus;
use tokio::sync::Mutex;

#[derive(Clone, Default)]
pub struct MemoryEventBus {
    topics: Arc<Mutex<HashMap<String, VecDeque<serde_json::Value>>>>,
}

impl MemoryEventBus {
    pub fn new() -> Self {
        Self::default()
    }
}

#[async_trait]
impl EventBus for MemoryEventBus {
    async fn publish(&self, topic: &str, payload: serde_json::Value) -> anyhow::Result<()> {
        self.topics
            .lock()
            .await
            .entry(topic.to_string())
            .or_default()
            .push_back(payload);
        Ok(())
    }

    async fn poll(&self, topic: &str) -> anyhow::Result<Option<serde_json::Value>> {
        Ok(self
            .topics
            .lock()
            .await
            .get_mut(topic)
            .and_then(VecDeque::pop_front))
    }
}
