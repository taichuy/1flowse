use domain::{
    RuntimeEventDurability, RuntimeEventLayer, RuntimeEventSource, RuntimeItemKind,
    RuntimeSpanKind, RuntimeTrustLevel,
};

#[test]
fn runtime_observability_enum_strings_are_stable() {
    assert_eq!(RuntimeSpanKind::LlmTurn.as_str(), "llm_turn");
    assert_eq!(RuntimeEventLayer::ProviderRaw.as_str(), "provider_raw");
    assert_eq!(RuntimeEventSource::GatewayRelay.as_str(), "gateway_relay");
    assert_eq!(
        RuntimeTrustLevel::ExternalOpaque.as_str(),
        "external_opaque"
    );
    assert_eq!(RuntimeEventDurability::Sampled.as_str(), "sampled");
    assert_eq!(RuntimeItemKind::GatewayForward.as_str(), "gateway_forward");
}
