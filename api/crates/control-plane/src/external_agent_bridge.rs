#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum BridgeSignatureStatus {
    Valid,
    Invalid,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct NormalizedBridgeEvent {
    pub session_id: String,
    pub event_type: String,
    pub payload: serde_json::Value,
    pub trust_level: domain::RuntimeTrustLevel,
}

pub fn normalize_bridge_event(
    raw: serde_json::Value,
    signature_status: Option<BridgeSignatureStatus>,
) -> anyhow::Result<NormalizedBridgeEvent> {
    let session_id = raw
        .get("session_id")
        .and_then(serde_json::Value::as_str)
        .ok_or_else(|| anyhow::anyhow!("bridge event missing session_id"))?;
    let event_type = raw
        .get("event_type")
        .and_then(serde_json::Value::as_str)
        .ok_or_else(|| anyhow::anyhow!("bridge event missing event_type"))?;
    let trust_level = match signature_status {
        Some(BridgeSignatureStatus::Valid) => domain::RuntimeTrustLevel::VerifiedBridge,
        Some(BridgeSignatureStatus::Invalid) | None => domain::RuntimeTrustLevel::AgentReported,
    };

    Ok(NormalizedBridgeEvent {
        session_id: session_id.into(),
        event_type: event_type.into(),
        payload: raw
            .get("payload")
            .cloned()
            .unwrap_or_else(|| serde_json::json!({})),
        trust_level,
    })
}
