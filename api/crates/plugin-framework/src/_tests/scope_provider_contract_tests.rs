use plugin_framework::{
    parse_host_extension_contribution_manifest, HostContractCode, ScopeProviderCapability,
};

#[test]
fn scope_provider_contract_code_is_stable() {
    assert_eq!(HostContractCode::ScopeProvider.as_str(), "scope-provider");
}

#[test]
fn scope_provider_capabilities_are_stable_contract_methods() {
    let capabilities = [
        (ScopeProviderCapability::ListScopes, "list_scopes"),
        (
            ScopeProviderCapability::ResolveCurrentScope,
            "resolve_current_scope",
        ),
        (
            ScopeProviderCapability::LoadMembershipRole,
            "load_membership_role",
        ),
        (
            ScopeProviderCapability::ContributeGrantUiMetadata,
            "contribute_grant_ui_metadata",
        ),
        (
            ScopeProviderCapability::ExtendActorContext,
            "extend_actor_context",
        ),
    ];

    for (capability, expected) in capabilities {
        assert_eq!(
            serde_json::to_string(&capability).unwrap(),
            format!("\"{expected}\"")
        );
        assert_eq!(capability.as_str(), expected);
    }
}

#[test]
fn host_extension_contribution_can_declare_scope_provider_metadata() {
    let raw = r#"
schema_version: 1flowbase.host-extension/v1
extension_id: workspace-scope-host
version: 0.1.0
bootstrap_phase: boot
native:
  abi_version: 1flowbase.host.native/v1
  library: lib/workspace_scope_host
  entry_symbol: oneflowbase_host_extension_entry_v1
owned_resources: []
extends_resources:
  - data_models
infrastructure_providers: []
scope_providers:
  - provider_code: workspace
    display_name: Workspace Scope
    capabilities:
      - list_scopes
      - resolve_current_scope
      - load_membership_role
      - contribute_grant_ui_metadata
      - extend_actor_context
    grant_ui:
      surface: data_model_scope_grant
      display_name: Workspace Grant
      fields:
        - key: permission_profile
          label: Permission Profile
          type: select
          required: true
    actor_context_fields:
      - key: current_scope_id
        value_type: uuid
      - key: role_code
        value_type: string
routes: []
workers: []
migrations: []
"#;

    let manifest = parse_host_extension_contribution_manifest(raw).unwrap();
    let provider = &manifest.scope_providers[0];

    assert_eq!(provider.provider_code, "workspace");
    assert_eq!(
        provider.capabilities,
        vec![
            ScopeProviderCapability::ListScopes,
            ScopeProviderCapability::ResolveCurrentScope,
            ScopeProviderCapability::LoadMembershipRole,
            ScopeProviderCapability::ContributeGrantUiMetadata,
            ScopeProviderCapability::ExtendActorContext,
        ]
    );
    assert_eq!(
        provider.grant_ui.as_ref().unwrap().surface,
        "data_model_scope_grant"
    );
    assert_eq!(provider.actor_context_fields[0].key, "current_scope_id");
}

#[test]
fn rejects_scope_provider_without_declared_capabilities() {
    let raw = r#"
schema_version: 1flowbase.host-extension/v1
extension_id: workspace-scope-host
version: 0.1.0
bootstrap_phase: boot
native:
  abi_version: 1flowbase.host.native/v1
  library: lib/workspace_scope_host
  entry_symbol: oneflowbase_host_extension_entry_v1
owned_resources: []
extends_resources: []
infrastructure_providers: []
scope_providers:
  - provider_code: workspace
    display_name: Workspace Scope
    capabilities: []
routes: []
workers: []
migrations: []
"#;

    let err = parse_host_extension_contribution_manifest(raw).unwrap_err();
    assert!(err.to_string().contains("scope_providers[].capabilities"));
}
