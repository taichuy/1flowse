#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ResourceOwnerKind {
    Core,
    HostExtension,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ResourceScopeKind {
    System,
    Workspace,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ResourceDefinition {
    pub code: String,
    pub owner_kind: ResourceOwnerKind,
    pub owner_id: String,
    pub scope_kind: ResourceScopeKind,
}

impl ResourceDefinition {
    pub fn core(code: impl Into<String>, scope_kind: ResourceScopeKind) -> Self {
        Self {
            code: code.into(),
            owner_kind: ResourceOwnerKind::Core,
            owner_id: "core".to_string(),
            scope_kind,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ActionDefinition {
    pub resource_code: String,
    pub action_code: String,
    pub owner_kind: ResourceOwnerKind,
}

impl ActionDefinition {
    pub fn core(resource_code: impl Into<String>, action_code: impl Into<String>) -> Self {
        Self {
            resource_code: resource_code.into(),
            action_code: action_code.into(),
            owner_kind: ResourceOwnerKind::Core,
        }
    }
}
