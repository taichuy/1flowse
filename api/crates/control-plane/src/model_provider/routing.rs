use std::collections::HashMap;

use anyhow::Result;
use uuid::Uuid;

use crate::{
    errors::ControlPlaneError,
    model_provider::UpdateModelProviderRoutingCommand,
    ports::{ModelProviderRepository, UpsertModelProviderRoutingInput},
};

pub(crate) async fn primary_instance_ids_by_provider<R>(
    repository: &R,
    workspace_id: Uuid,
) -> Result<HashMap<String, Uuid>>
where
    R: ModelProviderRepository,
{
    Ok(repository
        .list_routings(workspace_id)
        .await?
        .into_iter()
        .map(|routing| (routing.provider_code, routing.primary_instance_id))
        .collect())
}

pub(crate) async fn primary_instance_id<R>(
    repository: &R,
    workspace_id: Uuid,
    provider_code: &str,
) -> Result<Option<Uuid>>
where
    R: ModelProviderRepository,
{
    Ok(repository
        .get_routing(workspace_id, provider_code)
        .await?
        .map(|routing| routing.primary_instance_id))
}

pub(crate) async fn resolve_primary_instance<R>(
    repository: &R,
    workspace_id: Uuid,
    provider_code: &str,
) -> Result<Option<domain::ModelProviderInstanceRecord>>
where
    R: ModelProviderRepository,
{
    let Some(primary_instance_id) =
        primary_instance_id(repository, workspace_id, provider_code).await?
    else {
        return Ok(None);
    };

    let instance = repository
        .get_instance(workspace_id, primary_instance_id)
        .await?;

    Ok(instance.filter(|record| {
        record.provider_code == provider_code
            && record.status == domain::ModelProviderInstanceStatus::Ready
    }))
}

pub(crate) async fn update_routing<R>(
    repository: &R,
    workspace_id: Uuid,
    command: &UpdateModelProviderRoutingCommand,
) -> Result<(
    domain::ModelProviderRoutingRecord,
    domain::ModelProviderInstanceRecord,
)>
where
    R: ModelProviderRepository,
{
    let provider_exists = repository
        .list_instances(workspace_id)
        .await?
        .into_iter()
        .any(|instance| instance.provider_code == command.provider_code);
    if !provider_exists {
        return Err(ControlPlaneError::NotFound("model_provider").into());
    }

    let primary_instance = repository
        .get_instance(workspace_id, command.primary_instance_id)
        .await?
        .ok_or(ControlPlaneError::NotFound("model_provider_instance"))?;
    if primary_instance.provider_code != command.provider_code
        || primary_instance.status != domain::ModelProviderInstanceStatus::Ready
    {
        return Err(ControlPlaneError::InvalidInput("primary_instance_id").into());
    }

    let routing_record = repository
        .upsert_routing(&UpsertModelProviderRoutingInput {
            workspace_id,
            provider_code: command.provider_code.clone(),
            routing_mode: command.routing_mode,
            primary_instance_id: command.primary_instance_id,
            updated_by: command.actor_user_id,
        })
        .await?;

    Ok((routing_record, primary_instance))
}
