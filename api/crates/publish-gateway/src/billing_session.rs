#[derive(Debug, Clone, PartialEq, Eq)]
pub struct BillingSessionState {
    pub session_id: String,
    pub idempotency_key: String,
    pub status: domain::BillingSessionStatus,
    pub usage_ledger_id: Option<String>,
    pub refund_reason: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum BillingSessionTransition {
    Settle { usage_ledger_id: String },
    Refund { reason: String },
    Fail { reason: String },
}

impl BillingSessionState {
    pub fn reserved(session_id: impl Into<String>, idempotency_key: impl Into<String>) -> Self {
        Self {
            session_id: session_id.into(),
            idempotency_key: idempotency_key.into(),
            status: domain::BillingSessionStatus::Reserved,
            usage_ledger_id: None,
            refund_reason: None,
        }
    }

    pub fn apply(&self, transition: BillingSessionTransition) -> Result<Self, String> {
        match (&self.status, transition) {
            (
                domain::BillingSessionStatus::Reserved,
                BillingSessionTransition::Settle { usage_ledger_id },
            ) => {
                let mut next = self.clone();
                next.status = domain::BillingSessionStatus::Settled;
                next.usage_ledger_id = Some(usage_ledger_id);
                Ok(next)
            }
            (
                domain::BillingSessionStatus::Settled,
                BillingSessionTransition::Settle { usage_ledger_id },
            ) if self.usage_ledger_id.as_deref() == Some(usage_ledger_id.as_str()) => {
                Ok(self.clone())
            }
            (
                domain::BillingSessionStatus::Reserved,
                BillingSessionTransition::Refund { reason },
            ) => {
                let mut next = self.clone();
                next.status = domain::BillingSessionStatus::Refunded;
                next.refund_reason = Some(reason);
                Ok(next)
            }
            (
                domain::BillingSessionStatus::Refunded,
                BillingSessionTransition::Refund { reason },
            ) if self.refund_reason.as_deref() == Some(reason.as_str()) => Ok(self.clone()),
            (domain::BillingSessionStatus::Reserved, BillingSessionTransition::Fail { reason }) => {
                let mut next = self.clone();
                next.status = domain::BillingSessionStatus::Failed;
                next.refund_reason = Some(reason);
                Ok(next)
            }
            _ => Err("invalid billing session transition".into()),
        }
    }
}
