use control_plane::runtime_observability::LiveEventCoalescer;
use plugin_framework::provider_contract::ProviderStreamEvent;

#[test]
fn live_event_coalescer_flushes_buffered_partial_deltas() {
    let mut coalescer = LiveEventCoalescer::new(4096);

    assert!(coalescer
        .push(ProviderStreamEvent::TextDelta {
            delta: "hel".into(),
        })
        .is_empty());
    assert!(coalescer
        .push(ProviderStreamEvent::TextDelta { delta: "lo".into() })
        .is_empty());

    assert_eq!(
        coalescer.flush_buffered(),
        vec![ProviderStreamEvent::TextDelta {
            delta: "hello".into()
        }]
    );
    assert!(coalescer.finish().is_empty());
}
