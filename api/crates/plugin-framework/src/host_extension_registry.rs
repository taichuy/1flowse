use std::collections::{BTreeMap, BTreeSet};

use crate::error::{FrameworkResult, PluginFrameworkError};

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct RegisteredHostExtension {
    pub extension_id: String,
    pub provides_contracts: Vec<String>,
    pub overrides_contracts: Vec<String>,
    pub registers_slots: Vec<String>,
    pub registers_storage: Vec<(String, String)>,
}

#[derive(Debug, Default)]
pub struct HostExtensionRegistry {
    contracts: BTreeMap<String, String>,
    slots: BTreeMap<String, String>,
    storage: BTreeMap<String, String>,
    extensions: BTreeSet<String>,
}

impl HostExtensionRegistry {
    pub fn register(&mut self, extension: RegisteredHostExtension) -> FrameworkResult<()> {
        if !self.extensions.insert(extension.extension_id.clone()) {
            return Err(PluginFrameworkError::invalid_provider_package(format!(
                "duplicate host extension: {}",
                extension.extension_id
            )));
        }

        for contract in extension.provides_contracts {
            if self.contracts.contains_key(&contract) {
                return Err(PluginFrameworkError::invalid_provider_package(format!(
                    "host contract {contract} already registered"
                )));
            }
            self.contracts
                .insert(contract, extension.extension_id.clone());
        }

        for contract in extension.overrides_contracts {
            self.contracts
                .insert(contract, extension.extension_id.clone());
        }

        for slot in extension.registers_slots {
            self.slots.insert(slot, extension.extension_id.clone());
        }

        for (kind, implementation) in extension.registers_storage {
            self.storage.insert(kind, implementation);
        }

        Ok(())
    }

    pub fn contract_provider(&self, contract: &str) -> Option<&str> {
        self.contracts.get(contract).map(String::as_str)
    }

    pub fn slot_provider(&self, slot: &str) -> Option<&str> {
        self.slots.get(slot).map(String::as_str)
    }

    pub fn storage_implementation(&self, kind: &str) -> Option<&str> {
        self.storage.get(kind).map(String::as_str)
    }
}
