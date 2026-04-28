pub fn builtin_host_extension_manifests() -> Vec<&'static str> {
    vec![
        IDENTITY_HOST,
        WORKSPACE_HOST,
        PLUGIN_HOST,
        STORAGE_HOST,
        MODEL_RUNTIME_HOST,
        DATA_ACCESS_HOST,
        FILE_MANAGEMENT_HOST,
        RUNTIME_ORCHESTRATION_HOST,
        OBSERVABILITY_HOST,
    ]
}

const IDENTITY_HOST: &str = r#"
manifest_version: 1
extension_id: official.identity-host
version: 0.1.0
display_name: Identity Host
source_kind: builtin
trust_level: trusted_host
activation_phase: boot
provides_contracts: [identity]
overrides_contracts: []
registers_slots: []
registers_interfaces: []
registers_storage: []
dependencies: []
load_order: { after: [], before: [] }
"#;

const WORKSPACE_HOST: &str = r#"
manifest_version: 1
extension_id: official.workspace-host
version: 0.1.0
display_name: Workspace Host
source_kind: builtin
trust_level: trusted_host
activation_phase: boot
provides_contracts: [workspace]
overrides_contracts: []
registers_slots: []
registers_interfaces: []
registers_storage: []
dependencies:
  - { extension_id: official.identity-host, version_range: ">=0.1.0" }
load_order: { after: [official.identity-host], before: [] }
"#;

const PLUGIN_HOST: &str = r#"
manifest_version: 1
extension_id: official.plugin-host
version: 0.1.0
display_name: Plugin Host
source_kind: builtin
trust_level: trusted_host
activation_phase: boot
provides_contracts: [plugin_management]
overrides_contracts: []
registers_slots: []
registers_interfaces: []
registers_storage: []
dependencies:
  - { extension_id: official.identity-host, version_range: ">=0.1.0" }
load_order: { after: [official.identity-host], before: [] }
"#;

const STORAGE_HOST: &str = r#"
manifest_version: 1
extension_id: official.storage-host
version: 0.1.0
display_name: Storage Host
source_kind: builtin
trust_level: trusted_host
activation_phase: boot
provides_contracts: [storage-durable, storage-ephemeral, storage-object]
overrides_contracts: []
registers_slots: []
registers_interfaces:
  - { code: storage.health, kind: internal_service }
registers_storage:
  - { kind: storage-durable, implementation: postgres }
  - { kind: storage-ephemeral, implementation: memory }
  - { kind: storage-object, implementation: local }
dependencies:
  - { extension_id: official.plugin-host, version_range: ">=0.1.0" }
load_order: { after: [official.plugin-host], before: [] }
"#;

const MODEL_RUNTIME_HOST: &str = r#"
manifest_version: 1
extension_id: official.model-runtime-host
version: 0.1.0
display_name: Model Runtime Host
source_kind: builtin
trust_level: trusted_host
activation_phase: boot
provides_contracts: [model_runtime]
overrides_contracts: []
registers_slots: [model_provider, embedding_provider, reranker_provider]
registers_interfaces: []
registers_storage: []
dependencies:
  - { extension_id: official.plugin-host, version_range: ">=0.1.0" }
load_order: { after: [official.plugin-host], before: [] }
"#;

const DATA_ACCESS_HOST: &str = r#"
manifest_version: 1
extension_id: official.data-access-host
version: 0.1.0
display_name: Data Access Host
source_kind: builtin
trust_level: trusted_host
activation_phase: boot
provides_contracts: [data_access]
overrides_contracts: []
registers_slots: [data_source, data_import_snapshot]
registers_interfaces: []
registers_storage: []
dependencies:
  - { extension_id: official.storage-host, version_range: ">=0.1.0" }
load_order: { after: [official.storage-host], before: [] }
"#;

const FILE_MANAGEMENT_HOST: &str = r#"
manifest_version: 1
extension_id: official.file-management-host
version: 0.1.0
display_name: File Management Host
source_kind: builtin
trust_level: trusted_host
activation_phase: boot
provides_contracts: [file_management]
overrides_contracts: []
registers_slots: [file_processor]
registers_interfaces: []
registers_storage: []
dependencies:
  - { extension_id: official.storage-host, version_range: ">=0.1.0" }
load_order: { after: [official.storage-host], before: [] }
"#;

const RUNTIME_ORCHESTRATION_HOST: &str = r#"
manifest_version: 1
extension_id: official.runtime-orchestration-host
version: 0.1.0
display_name: Runtime Orchestration Host
source_kind: builtin
trust_level: trusted_host
activation_phase: boot
provides_contracts: [runtime_orchestration]
overrides_contracts: []
registers_slots: []
registers_interfaces: []
registers_storage: []
dependencies:
  - { extension_id: official.model-runtime-host, version_range: ">=0.1.0" }
load_order: { after: [official.model-runtime-host], before: [] }
"#;

const OBSERVABILITY_HOST: &str = r#"
manifest_version: 1
extension_id: official.observability-host
version: 0.1.0
display_name: Observability Host
source_kind: builtin
trust_level: trusted_host
activation_phase: boot
provides_contracts: [observability]
overrides_contracts: []
registers_slots: []
registers_interfaces: []
registers_storage: []
dependencies:
  - { extension_id: official.storage-host, version_range: ">=0.1.0" }
load_order: { after: [official.storage-host], before: [] }
"#;
