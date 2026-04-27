#[derive(Debug, Clone, PartialEq, Eq, serde::Serialize, serde::Deserialize)]
pub struct GatewayRouteTrace {
    pub logical_model_id: String,
    pub route_id: Option<String>,
    pub provider_instance_id: Option<String>,
    pub provider_account_id: Option<String>,
    pub upstream_model_id: Option<String>,
    pub routing_mode: String,
    pub trust_level: domain::RuntimeTrustLevel,
}
