use serde::{Deserialize, Serialize};
use serde_json::Value;
use uuid::Uuid;

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum RuntimeBusEvent {
    SpanStarted {
        span_id: Uuid,
        kind: String,
        name: String,
    },
    SpanFinished {
        span_id: Uuid,
        status: String,
    },
    TextDelta {
        delta: String,
    },
    ReasoningDelta {
        delta: String,
    },
    RuntimeEvent {
        event_type: String,
        payload: Value,
    },
    LedgerRef {
        ledger_ref: String,
    },
    Error {
        message: String,
        payload: Value,
    },
}

#[derive(Clone)]
pub struct RuntimeEventBus {
    sender: tokio::sync::broadcast::Sender<RuntimeBusEvent>,
}

impl RuntimeEventBus {
    pub fn new(capacity: usize) -> Self {
        let (sender, _) = tokio::sync::broadcast::channel(capacity);
        Self { sender }
    }

    pub fn publish(&self, event: RuntimeBusEvent) {
        let _ = self.sender.send(event);
    }

    pub fn subscribe(&self) -> tokio::sync::broadcast::Receiver<RuntimeBusEvent> {
        self.sender.subscribe()
    }
}
