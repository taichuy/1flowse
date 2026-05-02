use std::{
    collections::{HashMap, VecDeque},
    sync::{
        atomic::{AtomicBool, AtomicI64, Ordering},
        Arc, Mutex,
    },
};

use anyhow::{anyhow, Result};
use control_plane::ports::{
    RuntimeEventCloseReason, RuntimeEventDurability, RuntimeEventEnvelope,
    RuntimeEventOverflowBehavior, RuntimeEventPayload, RuntimeEventStream,
    RuntimeEventStreamPolicy, RuntimeEventSubscription, RuntimeEventTrimPolicy,
};
use tokio::sync::{broadcast, mpsc};
use uuid::Uuid;

const DEFAULT_BROADCAST_CAPACITY: usize = 1024;

#[derive(Clone)]
pub struct LocalRuntimeEventStream {
    runs: Arc<Mutex<HashMap<Uuid, Arc<LocalRunEventStream>>>>,
    broadcast_capacity: usize,
}

struct LocalRunEventStream {
    next_sequence: AtomicI64,
    ring: Mutex<VecDeque<RuntimeEventEnvelope>>,
    broadcaster: broadcast::Sender<RuntimeEventEnvelope>,
    policy: RuntimeEventStreamPolicy,
    closed: AtomicBool,
}

impl Default for LocalRuntimeEventStream {
    fn default() -> Self {
        Self {
            runs: Arc::new(Mutex::new(HashMap::new())),
            broadcast_capacity: DEFAULT_BROADCAST_CAPACITY,
        }
    }
}

impl LocalRuntimeEventStream {
    pub fn new() -> Self {
        Self::default()
    }

    #[cfg(test)]
    pub(crate) fn with_broadcast_capacity_for_tests(broadcast_capacity: usize) -> Self {
        Self {
            runs: Arc::new(Mutex::new(HashMap::new())),
            broadcast_capacity: broadcast_capacity.max(1),
        }
    }

    fn run(&self, run_id: Uuid) -> Result<Arc<LocalRunEventStream>> {
        self.runs
            .lock()
            .expect("runtime event stream runs lock poisoned")
            .get(&run_id)
            .cloned()
            .ok_or_else(|| anyhow!("runtime event stream is not open"))
    }
}

impl LocalRunEventStream {
    fn new(policy: RuntimeEventStreamPolicy, broadcast_capacity: usize) -> Self {
        let (broadcaster, _) = broadcast::channel(broadcast_capacity);
        Self {
            next_sequence: AtomicI64::new(1),
            ring: Mutex::new(VecDeque::new()),
            broadcaster,
            policy,
            closed: AtomicBool::new(false),
        }
    }

    fn replay_from_ring(
        &self,
        from_sequence: Option<i64>,
        limit: usize,
    ) -> Result<Vec<RuntimeEventEnvelope>> {
        let requested_sequence = from_sequence.unwrap_or(0);
        let ring = self.ring.lock().expect("runtime event ring lock poisoned");

        if let Some(front) = ring.front() {
            if requested_sequence < front.sequence - 1 {
                return Err(anyhow!("runtime event replay expired"));
            }
        } else if requested_sequence < self.next_sequence.load(Ordering::SeqCst) - 1 {
            return Err(anyhow!("runtime event replay expired"));
        }

        Ok(ring
            .iter()
            .filter(|event| event.sequence > requested_sequence)
            .take(limit)
            .cloned()
            .collect())
    }

    fn events_after_sequence(&self, sequence: i64, limit: usize) -> Vec<RuntimeEventEnvelope> {
        let ring = self.ring.lock().expect("runtime event ring lock poisoned");
        ring.iter()
            .filter(|event| event.sequence > sequence)
            .take(limit)
            .cloned()
            .collect()
    }

    fn trim_overflow(&self, ring: &mut VecDeque<RuntimeEventEnvelope>) {
        match self.policy.overflow_behavior {
            RuntimeEventOverflowBehavior::DropOldEphemeralKeepRequired => {
                while ring.len() > self.policy.max_events {
                    if let Some(index) = ring.iter().position(|event| !is_required_event(event)) {
                        ring.remove(index);
                    } else {
                        break;
                    }
                }
            }
        }
    }
}

fn is_required_event(event: &RuntimeEventEnvelope) -> bool {
    event.persist_required
        || matches!(
            event.durability,
            RuntimeEventDurability::DurableRequired | RuntimeEventDurability::AuditRequired
        )
}

fn send_retained_after_sequence(
    run: &LocalRunEventStream,
    sender: &mpsc::UnboundedSender<RuntimeEventEnvelope>,
    last_sent_sequence: &mut i64,
) -> bool {
    for event in run.events_after_sequence(*last_sent_sequence, usize::MAX) {
        let sequence = event.sequence;
        if sender.send(event).is_err() {
            return false;
        }
        *last_sent_sequence = sequence;
    }
    true
}

#[async_trait::async_trait]
impl RuntimeEventStream for LocalRuntimeEventStream {
    async fn open_run(&self, run_id: Uuid, policy: RuntimeEventStreamPolicy) -> Result<()> {
        self.runs
            .lock()
            .expect("runtime event stream runs lock poisoned")
            .entry(run_id)
            .or_insert_with(|| Arc::new(LocalRunEventStream::new(policy, self.broadcast_capacity)));
        Ok(())
    }

    async fn append(
        &self,
        run_id: Uuid,
        event: RuntimeEventPayload,
    ) -> Result<RuntimeEventEnvelope> {
        let run = self.run(run_id)?;

        let envelope = {
            let mut ring = run.ring.lock().expect("runtime event ring lock poisoned");
            if run.closed.load(Ordering::SeqCst) {
                return Err(anyhow!("runtime event stream is closed"));
            }

            let sequence = run.next_sequence.fetch_add(1, Ordering::SeqCst);
            let envelope = RuntimeEventEnvelope::new(run_id, sequence, event);
            ring.push_back(envelope.clone());
            run.trim_overflow(&mut ring);
            envelope
        };

        let _ = run.broadcaster.send(envelope.clone());
        Ok(envelope)
    }

    async fn subscribe(
        &self,
        run_id: Uuid,
        from_sequence: Option<i64>,
    ) -> Result<RuntimeEventSubscription> {
        let run = self.run(run_id)?;
        let mut live_receiver = run.broadcaster.subscribe();
        let replay = run.replay_from_ring(from_sequence, usize::MAX)?;
        let mut last_sent_sequence = replay
            .last()
            .map(|event| event.sequence)
            .unwrap_or_else(|| from_sequence.unwrap_or(0));
        let (sender, live_events) = mpsc::unbounded_channel();
        let live_run = Arc::clone(&run);

        tokio::spawn(async move {
            loop {
                match live_receiver.recv().await {
                    Ok(event) if event.sequence <= last_sent_sequence => {}
                    Ok(event) => {
                        if !send_retained_after_sequence(
                            &live_run,
                            &sender,
                            &mut last_sent_sequence,
                        ) {
                            break;
                        }
                        if event.sequence <= last_sent_sequence {
                            continue;
                        }
                        let sequence = event.sequence;
                        if sender.send(event).is_err() {
                            break;
                        }
                        last_sent_sequence = sequence;
                    }
                    Err(broadcast::error::RecvError::Lagged(_)) => {
                        if !send_retained_after_sequence(
                            &live_run,
                            &sender,
                            &mut last_sent_sequence,
                        ) {
                            break;
                        }
                    }
                    Err(broadcast::error::RecvError::Closed) => break,
                }
            }
        });

        Ok(RuntimeEventSubscription {
            replay,
            live_events,
        })
    }

    async fn replay(
        &self,
        run_id: Uuid,
        from_sequence: Option<i64>,
        limit: usize,
    ) -> Result<Vec<RuntimeEventEnvelope>> {
        self.run(run_id)?.replay_from_ring(from_sequence, limit)
    }

    async fn close_run(&self, run_id: Uuid, _reason: RuntimeEventCloseReason) -> Result<()> {
        let run = self.run(run_id)?;
        let _ring = run.ring.lock().expect("runtime event ring lock poisoned");
        run.closed.store(true, Ordering::SeqCst);
        Ok(())
    }

    async fn trim(&self, run_id: Uuid, policy: RuntimeEventTrimPolicy) -> Result<()> {
        let run = self.run(run_id)?;
        if let Some(before_sequence) = policy.before_sequence {
            let mut ring = run.ring.lock().expect("runtime event ring lock poisoned");
            ring.retain(|event| {
                event.sequence >= before_sequence
                    || (policy.keep_required && is_required_event(event))
            });
            if ring.len() > run.policy.max_events {
                run.trim_overflow(&mut ring);
            }
        }
        Ok(())
    }
}
