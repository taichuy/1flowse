use crate::errors::ControlPlaneError;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum HostExtensionBootFailurePolicy {
    Unhealthy,
    SafeMode,
    Abort,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct HostExtensionDeploymentPolicy {
    pub allowed_sources: Vec<String>,
    pub allow_uploaded_host_extension: bool,
    pub allow_contract_override: Vec<String>,
    pub deny_contract_override: Vec<String>,
    pub boot_failure_policy: HostExtensionBootFailurePolicy,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct HostExtensionPolicyInput {
    pub extension_id: String,
    pub source_kind: String,
    pub overrides_contracts: Vec<String>,
}

pub fn evaluate_host_extension_policy(
    policy: &HostExtensionDeploymentPolicy,
    input: &HostExtensionPolicyInput,
) -> anyhow::Result<()> {
    if input.source_kind == "uploaded" && !policy.allow_uploaded_host_extension {
        return Err(ControlPlaneError::PermissionDenied("uploaded_host_extension").into());
    }
    if !policy
        .allowed_sources
        .iter()
        .any(|source| source == &input.source_kind)
    {
        return Err(ControlPlaneError::PermissionDenied("host_extension_source").into());
    }
    for contract in &input.overrides_contracts {
        if policy
            .deny_contract_override
            .iter()
            .any(|item| item == contract)
        {
            anyhow::bail!("host_contract_override denied: {contract}");
        }
        if !policy
            .allow_contract_override
            .iter()
            .any(|item| item == contract)
        {
            anyhow::bail!("host_contract_override not allowed: {contract}");
        }
    }
    Ok(())
}
