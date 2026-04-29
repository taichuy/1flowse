use plugin_framework::{
    HostExtensionBootstrapPhase, HostExtensionManifestV1, HostExtensionRegistry,
    RegisteredHostExtension,
};

pub fn register_builtin_host_extensions(
    manifests: &[HostExtensionManifestV1],
) -> anyhow::Result<HostExtensionRegistry> {
    let mut registry = HostExtensionRegistry::default();
    for manifest in manifests {
        registry.register(RegisteredHostExtension {
            extension_id: manifest.extension_id.clone(),
            bootstrap_phase: HostExtensionBootstrapPhase::Boot,
            provides_contracts: manifest.provides_contracts.clone(),
            overrides_contracts: manifest.overrides_contracts.clone(),
            registers_slots: manifest.registers_slots.clone(),
            registers_storage: manifest
                .registers_storage
                .iter()
                .map(|entry| (entry.kind.clone(), entry.implementation.clone()))
                .collect(),
            infrastructure_providers: vec![],
            owned_resources: vec![],
            extends_resources: vec![],
            routes: vec![],
            workers: vec![],
            migrations: vec![],
        })?;
    }
    Ok(registry)
}
