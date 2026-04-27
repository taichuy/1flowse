use crate::{BillingSessionState, BillingSessionTransition, IdempotencyStatus};
use crate::{FailSafeDecision, GatewayRouteTrace, ProviderAccountCandidate};

#[test]
fn billing_session_settle_is_idempotent() {
    let state = BillingSessionState::reserved("session-1", "idem-1");
    let settled = state
        .apply(BillingSessionTransition::Settle {
            usage_ledger_id: "usage-1".into(),
        })
        .unwrap();
    let replayed = settled
        .apply(BillingSessionTransition::Settle {
            usage_ledger_id: "usage-1".into(),
        })
        .unwrap();

    assert_eq!(settled, replayed);
}

#[test]
fn billing_session_refund_is_idempotent_after_reserve() {
    let state = BillingSessionState::reserved("session-1", "idem-1");
    let refunded = state
        .apply(BillingSessionTransition::Refund {
            reason: "provider_failed".into(),
        })
        .unwrap();
    let replayed = refunded
        .apply(BillingSessionTransition::Refund {
            reason: "provider_failed".into(),
        })
        .unwrap();

    assert_eq!(refunded, replayed);
}

#[test]
fn idempotency_status_strings_match_gateway_contract() {
    assert_eq!(IdempotencyStatus::Processing.as_str(), "processing");
    assert_eq!(IdempotencyStatus::Succeeded.as_str(), "succeeded");
    assert_eq!(
        IdempotencyStatus::FailedRetryable.as_str(),
        "failed_retryable"
    );
}

#[test]
fn account_selection_skips_exhausted_accounts() {
    let account = crate::select_provider_account(vec![
        ProviderAccountCandidate {
            id: "a".into(),
            priority: 1,
            health_status: "exhausted".into(),
            supports_model: true,
        },
        ProviderAccountCandidate {
            id: "b".into(),
            priority: 2,
            health_status: "healthy".into(),
            supports_model: true,
        },
    ])
    .unwrap();

    assert_eq!(account.id, "b");
}

#[test]
fn billing_unknown_fails_closed() {
    assert_eq!(
        crate::decide_fail_safe("billing_unknown"),
        FailSafeDecision::FailClosed
    );
}

#[test]
fn route_trace_marks_opaque_gateway_facts() {
    let trace = GatewayRouteTrace {
        logical_model_id: "logical-gpt".into(),
        route_id: None,
        provider_instance_id: None,
        provider_account_id: None,
        upstream_model_id: None,
        routing_mode: "raw_gateway".into(),
        trust_level: domain::RuntimeTrustLevel::ExternalOpaque,
    };

    assert_eq!(trace.trust_level, domain::RuntimeTrustLevel::ExternalOpaque);
}
