#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ProviderAccountCandidate {
    pub id: String,
    pub priority: i32,
    pub health_status: String,
    pub supports_model: bool,
}

pub fn select_provider_account(
    mut candidates: Vec<ProviderAccountCandidate>,
) -> Option<ProviderAccountCandidate> {
    candidates.sort_by_key(|candidate| candidate.priority);
    candidates.into_iter().find(|candidate| {
        candidate.supports_model
            && matches!(candidate.health_status.as_str(), "healthy" | "degraded")
    })
}
