use std::{collections::HashMap, future::Future, pin::Pin, sync::Arc};

use anyhow::Result;
use serde_json::Value;

use crate::errors::ControlPlaneError;

use super::ResourceActionRegistry;

type JsonHandlerFuture = Pin<Box<dyn Future<Output = Result<Value>> + Send>>;
type JsonHandler = Arc<dyn Fn(Value) -> JsonHandlerFuture + Send + Sync>;

#[derive(Clone)]
pub struct ResourceActionKernel {
    registry: ResourceActionRegistry,
    json_handlers: HashMap<(String, String), JsonHandler>,
}

impl ResourceActionKernel {
    pub fn new(registry: ResourceActionRegistry) -> Self {
        Self {
            registry,
            json_handlers: HashMap::new(),
        }
    }

    pub fn register_json_handler<F, Fut>(
        &mut self,
        resource_code: &str,
        action_code: &str,
        handler: F,
    ) -> Result<()>
    where
        F: Fn(Value) -> Fut + Send + Sync + 'static,
        Fut: Future<Output = Result<Value>> + Send + 'static,
    {
        if self.registry.action(resource_code, action_code).is_none() {
            return Err(ControlPlaneError::NotFound("resource_action").into());
        }

        let key = (resource_code.to_string(), action_code.to_string());
        if self.json_handlers.contains_key(&key) {
            return Err(ControlPlaneError::Conflict("duplicate action handler").into());
        }

        self.json_handlers
            .insert(key, Arc::new(move |input| Box::pin(handler(input))));
        Ok(())
    }

    pub async fn dispatch_json(
        &self,
        resource_code: &str,
        action_code: &str,
        input: Value,
    ) -> Result<Value> {
        if self.registry.action(resource_code, action_code).is_none() {
            return Err(ControlPlaneError::NotFound("resource_action").into());
        }

        let handler = self
            .json_handlers
            .get(&(resource_code.to_string(), action_code.to_string()))
            .ok_or(ControlPlaneError::NotFound("resource_action_handler"))?;

        handler(input).await
    }
}
