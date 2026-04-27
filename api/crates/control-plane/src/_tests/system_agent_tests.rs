#[test]
fn system_agent_high_risk_action_requires_approval() {
    let action = control_plane::system_agent::SystemAgentAction {
        action_kind: "write_business_state".into(),
        risk_level: "high".into(),
    };

    assert!(control_plane::system_agent::requires_approval(&action));
}

#[test]
fn system_agent_identity_is_not_external_bridge() {
    let identity = control_plane::system_agent::SystemAgentIdentity::system("billing-monitor");

    assert_eq!(identity.actor_kind, "system_agent");
    assert_ne!(identity.actor_kind, "external_agent");
}

#[test]
fn system_agent_low_risk_read_action_does_not_require_approval() {
    let action = control_plane::system_agent::SystemAgentAction {
        action_kind: "read_runtime_health".into(),
        risk_level: "low".into(),
    };

    assert!(!control_plane::system_agent::requires_approval(&action));
}
