use anyhow::{anyhow, Result};
use serde_json::Value;
use time::OffsetDateTime;
use uuid::Uuid;

use crate::ports::{
    CreateModelCatalogSyncRunInput, ModelProviderRepository, UpsertModelProviderCatalogEntryInput,
};

pub fn normalize_relay_model_entry(
    catalog_source_id: Uuid,
    raw: &Value,
) -> Result<UpsertModelProviderCatalogEntryInput> {
    let upstream_model_id = raw
        .get("upstream_model_id")
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .ok_or_else(|| anyhow!("relay model is missing upstream_model_id"))?;
    let protocol = raw
        .get("protocol")
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .ok_or_else(|| anyhow!("relay model is missing protocol"))?;

    Ok(UpsertModelProviderCatalogEntryInput {
        provider_instance_id: raw
            .get("provider_instance_id")
            .and_then(Value::as_str)
            .and_then(|value| Uuid::parse_str(value).ok()),
        catalog_source_id,
        upstream_model_id: upstream_model_id.to_string(),
        display_label: raw
            .get("display_label")
            .and_then(Value::as_str)
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .unwrap_or(upstream_model_id)
            .to_string(),
        protocol: protocol.to_string(),
        capability_snapshot: raw
            .get("capability_snapshot")
            .cloned()
            .unwrap_or_else(|| serde_json::json!({})),
        parameter_schema_ref: raw
            .get("parameter_schema_ref")
            .and_then(Value::as_str)
            .map(str::to_string),
        context_window: raw.get("context_window").and_then(Value::as_i64),
        max_output_tokens: raw.get("max_output_tokens").and_then(Value::as_i64),
        pricing_ref: raw
            .get("pricing_ref")
            .and_then(Value::as_str)
            .map(str::to_string)
            .or_else(|| {
                raw.get("pricing")
                    .map(|_| format!("runtime_artifact:pricing:{upstream_model_id}"))
            }),
        status: raw
            .get("status")
            .and_then(Value::as_str)
            .unwrap_or("active")
            .to_string(),
    })
}

pub async fn sync_relay_catalog_models<R>(
    repository: &R,
    catalog_source_id: Uuid,
    raw_models: Value,
) -> Result<domain::ModelCatalogSyncRunRecord>
where
    R: ModelProviderRepository,
{
    let models = raw_models
        .as_array()
        .ok_or_else(|| anyhow!("relay catalog payload must be an array"))?;
    let mut imported_count = 0_i64;

    for raw in models {
        let input = normalize_relay_model_entry(catalog_source_id, raw)?;
        repository.upsert_catalog_entry(&input).await?;
        imported_count += 1;
    }

    let now = OffsetDateTime::now_utc();
    repository
        .create_catalog_sync_run(&CreateModelCatalogSyncRunInput {
            sync_run_id: Uuid::now_v7(),
            catalog_source_id,
            status: "succeeded".to_string(),
            error_message_ref: None,
            discovered_count: models.len() as i64,
            imported_count,
            disabled_count: 0,
            started_at: now,
            finished_at: Some(now),
        })
        .await
}
