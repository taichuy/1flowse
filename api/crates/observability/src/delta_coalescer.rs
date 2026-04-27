use crate::RuntimeBusEvent;

#[derive(Debug, Clone)]
pub struct DeltaCoalescer {
    max_bytes: usize,
    text: String,
    reasoning: String,
}

impl DeltaCoalescer {
    pub fn new(max_bytes: usize) -> Self {
        Self {
            max_bytes,
            text: String::new(),
            reasoning: String::new(),
        }
    }

    pub fn push_text(&mut self, delta: &str) -> Option<RuntimeBusEvent> {
        self.text.push_str(delta);
        if self.text.len() >= self.max_bytes {
            self.flush_text()
        } else {
            None
        }
    }

    pub fn push_reasoning(&mut self, delta: &str) -> Option<RuntimeBusEvent> {
        self.reasoning.push_str(delta);
        if self.reasoning.len() >= self.max_bytes {
            self.flush_reasoning()
        } else {
            None
        }
    }

    pub fn flush_text(&mut self) -> Option<RuntimeBusEvent> {
        if self.text.is_empty() {
            return None;
        }

        Some(RuntimeBusEvent::TextDelta {
            delta: std::mem::take(&mut self.text),
        })
    }

    pub fn flush_reasoning(&mut self) -> Option<RuntimeBusEvent> {
        if self.reasoning.is_empty() {
            return None;
        }

        Some(RuntimeBusEvent::ReasoningDelta {
            delta: std::mem::take(&mut self.reasoning),
        })
    }
}
