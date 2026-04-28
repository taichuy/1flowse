use plugin_framework::{HostExtensionManifestV1, HostExtensionRegistry, RegisteredHostExtension};

pub fn register_builtin_host_extensions(
    manifests: &[HostExtensionManifestV1],
) -> anyhow::Result<HostExtensionRegistry> {
    let mut registry = HostExtensionRegistry::default();
    for manifest in manifests {
        registry.register(RegisteredHostExtension {
            extension_id: manifest.extension_id.clone(),
            provides_contracts: manifest.provides_contracts.clone(),
            overrides_contracts: manifest.overrides_contracts.clone(),
            registers_slots: manifest.registers_slots.clone(),
            registers_storage: manifest
                .registers_storage
                .iter()
                .map(|entry| (entry.kind.clone(), entry.implementation.clone()))
                .collect(),
        })?;
    }
    Ok(registry)
}
