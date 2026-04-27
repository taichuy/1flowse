#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum IdempotencyStatus {
    Processing,
    Succeeded,
    FailedRetryable,
}

impl IdempotencyStatus {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Processing => "processing",
            Self::Succeeded => "succeeded",
            Self::FailedRetryable => "failed_retryable",
        }
    }
}
