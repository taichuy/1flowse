use serde::{Deserialize, Serialize};

use crate::error::{FrameworkResult, PluginFrameworkError};
use crate::provider_contract::PluginFormFieldSchema;

pub const SCOPE_PROVIDER_CONTRACT_CODE: &str = "scope-provider";

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ScopeProviderCapability {
    ListScopes,
    ResolveCurrentScope,
    LoadMembershipRole,
    ContributeGrantUiMetadata,
    ExtendActorContext,
}

impl ScopeProviderCapability {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::ListScopes => "list_scopes",
            Self::ResolveCurrentScope => "resolve_current_scope",
            Self::LoadMembershipRole => "load_membership_role",
            Self::ContributeGrantUiMetadata => "contribute_grant_ui_metadata",
            Self::ExtendActorContext => "extend_actor_context",
        }
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct ScopeGrantUiContributionManifest {
    pub surface: String,
    pub display_name: String,
    #[serde(default)]
    pub fields: Vec<PluginFormFieldSchema>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct ScopeActorContextFieldManifest {
    pub key: String,
    pub value_type: String,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct ScopeProviderContributionManifest {
    pub provider_code: String,
    pub display_name: String,
    #[serde(default)]
    pub description: Option<String>,
    pub capabilities: Vec<ScopeProviderCapability>,
    #[serde(default)]
    pub grant_ui: Option<ScopeGrantUiContributionManifest>,
    #[serde(default)]
    pub actor_context_fields: Vec<ScopeActorContextFieldManifest>,
}

impl ScopeProviderContributionManifest {
    pub fn declares(&self, capability: ScopeProviderCapability) -> bool {
        self.capabilities.contains(&capability)
    }
}

pub fn validate_scope_provider_contribution(
    provider: &ScopeProviderContributionManifest,
) -> FrameworkResult<()> {
    validate_non_empty(&provider.provider_code, "scope_providers[].provider_code")?;
    validate_non_empty(&provider.display_name, "scope_providers[].display_name")?;
    if provider.capabilities.is_empty() {
        return Err(PluginFrameworkError::invalid_provider_package(
            "scope_providers[].capabilities must not be empty",
        ));
    }

    validate_grant_ui(provider)?;
    validate_actor_context_fields(provider)?;

    Ok(())
}

fn validate_grant_ui(provider: &ScopeProviderContributionManifest) -> FrameworkResult<()> {
    let declares_grant_ui = provider.declares(ScopeProviderCapability::ContributeGrantUiMetadata);
    if declares_grant_ui && provider.grant_ui.is_none() {
        return Err(PluginFrameworkError::invalid_provider_package(
            "scope_providers[].grant_ui is required when contribute_grant_ui_metadata is declared",
        ));
    }
    if !declares_grant_ui && provider.grant_ui.is_some() {
        return Err(PluginFrameworkError::invalid_provider_package(
            "scope_providers[].grant_ui requires contribute_grant_ui_metadata capability",
        ));
    }

    if let Some(grant_ui) = &provider.grant_ui {
        validate_non_empty(&grant_ui.surface, "scope_providers[].grant_ui.surface")?;
        validate_non_empty(
            &grant_ui.display_name,
            "scope_providers[].grant_ui.display_name",
        )?;
        for field in &grant_ui.fields {
            validate_non_empty(&field.key, "scope_providers[].grant_ui.fields[].key")?;
            validate_non_empty(&field.label, "scope_providers[].grant_ui.fields[].label")?;
            validate_non_empty(
                &field.field_type,
                "scope_providers[].grant_ui.fields[].type",
            )?;
        }
    }

    Ok(())
}

fn validate_actor_context_fields(
    provider: &ScopeProviderContributionManifest,
) -> FrameworkResult<()> {
    let declares_actor_context = provider.declares(ScopeProviderCapability::ExtendActorContext);
    if declares_actor_context && provider.actor_context_fields.is_empty() {
        return Err(PluginFrameworkError::invalid_provider_package(
            "scope_providers[].actor_context_fields is required when extend_actor_context is declared",
        ));
    }
    if !declares_actor_context && !provider.actor_context_fields.is_empty() {
        return Err(PluginFrameworkError::invalid_provider_package(
            "scope_providers[].actor_context_fields requires extend_actor_context capability",
        ));
    }

    for field in &provider.actor_context_fields {
        validate_non_empty(&field.key, "scope_providers[].actor_context_fields[].key")?;
        validate_non_empty(
            &field.value_type,
            "scope_providers[].actor_context_fields[].value_type",
        )?;
    }

    Ok(())
}

fn validate_non_empty(value: &str, field: &str) -> FrameworkResult<()> {
    if value.trim().is_empty() {
        return Err(PluginFrameworkError::invalid_provider_package(format!(
            "{field} must not be empty"
        )));
    }
    Ok(())
}
