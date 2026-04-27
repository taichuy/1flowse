#[test]
fn unsigned_bridge_event_is_agent_reported_not_verified() {
    let event = control_plane::external_agent_bridge::normalize_bridge_event(
        serde_json::json!({
            "session_id": "s-1",
            "event_type": "tool_call",
            "payload": { "name": "shell" }
        }),
        None,
    )
    .unwrap();

    assert_eq!(event.session_id, "s-1");
    assert_eq!(event.event_type, "tool_call");
    assert_eq!(event.payload["name"], "shell");
    assert_eq!(event.trust_level, domain::RuntimeTrustLevel::AgentReported);
}

#[test]
fn bridge_event_with_valid_signature_is_verified_bridge() {
    let event = control_plane::external_agent_bridge::normalize_bridge_event(
        serde_json::json!({
            "session_id": "s-1",
            "event_type": "tool_call",
            "payload": { "name": "shell" }
        }),
        Some(control_plane::external_agent_bridge::BridgeSignatureStatus::Valid),
    )
    .unwrap();

    assert_eq!(event.trust_level, domain::RuntimeTrustLevel::VerifiedBridge);
}

#[test]
fn bridge_event_with_invalid_signature_is_agent_reported() {
    let event = control_plane::external_agent_bridge::normalize_bridge_event(
        serde_json::json!({
            "session_id": "s-1",
            "event_type": "tool_call",
            "payload": { "name": "shell" }
        }),
        Some(control_plane::external_agent_bridge::BridgeSignatureStatus::Invalid),
    )
    .unwrap();

    assert_eq!(event.trust_level, domain::RuntimeTrustLevel::AgentReported);
}
