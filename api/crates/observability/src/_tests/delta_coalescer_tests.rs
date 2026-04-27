use crate::{DeltaCoalescer, RuntimeBusEvent};

#[test]
fn coalesces_text_until_limit() {
    let mut coalescer = DeltaCoalescer::new(12);

    assert!(coalescer.push_text("hello ").is_none());
    let event = coalescer.push_text("world!").unwrap();

    assert_eq!(
        event,
        RuntimeBusEvent::TextDelta {
            delta: "hello world!".into()
        }
    );
}

#[test]
fn flushes_reasoning_delta_explicitly() {
    let mut coalescer = DeltaCoalescer::new(100);

    assert!(coalescer.push_reasoning("thinking").is_none());
    assert_eq!(
        coalescer.flush_reasoning(),
        Some(RuntimeBusEvent::ReasoningDelta {
            delta: "thinking".into()
        })
    );
}
