use std::collections::HashMap;

use crate::errors::ControlPlaneError;

use super::{ActionDefinition, ResourceDefinition};

#[derive(Debug, Default, Clone)]
pub struct ResourceActionRegistry {
    resources: HashMap<String, ResourceDefinition>,
    actions: HashMap<(String, String), ActionDefinition>,
}

impl ResourceActionRegistry {
    pub fn register_resource(
        &mut self,
        resource: ResourceDefinition,
    ) -> Result<(), ControlPlaneError> {
        if self.resources.contains_key(&resource.code) {
            return Err(ControlPlaneError::Conflict("duplicate resource"));
        }

        self.resources.insert(resource.code.clone(), resource);
        Ok(())
    }

    pub fn register_action(&mut self, action: ActionDefinition) -> Result<(), ControlPlaneError> {
        if !self.resources.contains_key(&action.resource_code) {
            return Err(ControlPlaneError::InvalidInput("resource not registered"));
        }

        let key = (action.resource_code.clone(), action.action_code.clone());
        if self.actions.contains_key(&key) {
            return Err(ControlPlaneError::Conflict("duplicate action"));
        }

        self.actions.insert(key, action);
        Ok(())
    }

    pub fn action(
        &self,
        resource_code: &str,
        action_code: &str,
    ) -> Option<&ActionDefinition> {
        self.actions
            .get(&(resource_code.to_string(), action_code.to_string()))
    }
}
