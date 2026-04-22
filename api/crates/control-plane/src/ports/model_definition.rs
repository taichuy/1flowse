use super::*;

#[derive(Debug, Clone)]
pub struct CreateModelDefinitionInput {
    pub actor_user_id: Uuid,
    pub scope_kind: DataModelScopeKind,
    pub scope_id: Uuid,
    pub code: String,
    pub title: String,
}

#[derive(Debug, Clone)]
pub struct UpdateModelDefinitionInput {
    pub actor_user_id: Uuid,
    pub model_id: Uuid,
    pub title: String,
}

#[derive(Debug, Clone)]
pub struct AddModelFieldInput {
    pub actor_user_id: Uuid,
    pub model_id: Uuid,
    pub code: String,
    pub title: String,
    pub field_kind: ModelFieldKind,
    pub is_required: bool,
    pub is_unique: bool,
    pub default_value: Option<serde_json::Value>,
    pub display_interface: Option<String>,
    pub display_options: serde_json::Value,
    pub relation_target_model_id: Option<Uuid>,
    pub relation_options: serde_json::Value,
}

#[derive(Debug, Clone)]
pub struct UpdateModelFieldInput {
    pub actor_user_id: Uuid,
    pub model_id: Uuid,
    pub field_id: Uuid,
    pub title: String,
    pub is_required: bool,
    pub is_unique: bool,
    pub default_value: Option<serde_json::Value>,
    pub display_interface: Option<String>,
    pub display_options: serde_json::Value,
    pub relation_options: serde_json::Value,
}

#[async_trait]
pub trait ModelDefinitionRepository: Send + Sync {
    async fn load_actor_context_for_user(
        &self,
        actor_user_id: Uuid,
    ) -> anyhow::Result<ActorContext>;
    async fn list_model_definitions(
        &self,
        workspace_id: Uuid,
    ) -> anyhow::Result<Vec<ModelDefinitionRecord>>;
    async fn get_model_definition(
        &self,
        workspace_id: Uuid,
        model_id: Uuid,
    ) -> anyhow::Result<Option<ModelDefinitionRecord>>;
    async fn create_model_definition(
        &self,
        input: &CreateModelDefinitionInput,
    ) -> anyhow::Result<ModelDefinitionRecord>;
    async fn update_model_definition(
        &self,
        input: &UpdateModelDefinitionInput,
    ) -> anyhow::Result<ModelDefinitionRecord>;
    async fn add_model_field(&self, input: &AddModelFieldInput)
        -> anyhow::Result<ModelFieldRecord>;
    async fn update_model_field(
        &self,
        input: &UpdateModelFieldInput,
    ) -> anyhow::Result<ModelFieldRecord>;
    async fn delete_model_definition(
        &self,
        actor_user_id: Uuid,
        model_id: Uuid,
    ) -> anyhow::Result<()>;
    async fn delete_model_field(
        &self,
        actor_user_id: Uuid,
        model_id: Uuid,
        field_id: Uuid,
    ) -> anyhow::Result<()>;
    async fn publish_model_definition(
        &self,
        actor_user_id: Uuid,
        model_id: Uuid,
    ) -> anyhow::Result<ModelDefinitionRecord>;
    async fn append_audit_log(&self, event: &AuditLogRecord) -> anyhow::Result<()>;
}
