#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum FailSafeDecision {
    Continue,
    MarkOpaque,
    PauseForApproval,
    FailClosed,
}

pub fn decide_fail_safe(condition: &str) -> FailSafeDecision {
    match condition {
        "billing_unknown" | "usage_cost_unavailable" => FailSafeDecision::FailClosed,
        "telemetry_bridge_unavailable" => FailSafeDecision::MarkOpaque,
        "high_risk_capability_without_approval" => FailSafeDecision::PauseForApproval,
        _ => FailSafeDecision::Continue,
    }
}
