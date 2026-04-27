use anyhow::{anyhow, bail, Result};
use async_trait::async_trait;
use control_plane::{
    errors::ControlPlaneError,
    ports::{
        CreateModelCatalogSyncRunInput, CreateModelFailoverQueueItemInput,
        CreateModelFailoverQueueSnapshotInput, CreateModelFailoverQueueTemplateInput,
        CreateModelProviderCatalogSourceInput, CreateModelProviderInstanceInput,
        CreateModelProviderPreviewSessionInput, ModelProviderRepository,
        ReassignModelProviderInstancesInput, UpdateModelProviderInstanceInput,
        UpsertModelProviderCatalogCacheInput, UpsertModelProviderCatalogEntryInput,
        UpsertModelProviderMainInstanceInput, UpsertModelProviderSecretInput,
    },
};
use serde_json::{json, Value};
use sqlx::Row;
use uuid::Uuid;

use crate::{
    mappers::model_provider_mapper::{
        PgModelProviderMapper, StoredModelProviderCatalogCacheRow, StoredModelProviderInstanceRow,
        StoredModelProviderMainInstanceRow, StoredModelProviderPreviewSessionRow,
        StoredModelProviderSecretRow,
    },
    repositories::PgControlPlaneStore,
};

fn map_instance(row: sqlx::postgres::PgRow) -> Result<domain::ModelProviderInstanceRecord> {
    PgModelProviderMapper::to_instance_record(StoredModelProviderInstanceRow {
        id: row.get("id"),
        workspace_id: row.get("workspace_id"),
        installation_id: row.get("installation_id"),
        provider_code: row.get("provider_code"),
        protocol: row.get("protocol"),
        display_name: row.get("display_name"),
        status: row.get("status"),
        config_json: row.get("config_json"),
        configured_models_json: row.get("configured_models_json"),
        enabled_model_ids: row.get("enabled_model_ids"),
        included_in_main: row.get("included_in_main"),
        created_by: row.get("created_by"),
        updated_by: row.get("updated_by"),
        created_at: row.get("created_at"),
        updated_at: row.get("updated_at"),
    })
}

fn map_main_instance(
    row: sqlx::postgres::PgRow,
) -> Result<domain::ModelProviderMainInstanceRecord> {
    PgModelProviderMapper::to_main_instance_record(StoredModelProviderMainInstanceRow {
        workspace_id: row.get("workspace_id"),
        provider_code: row.get("provider_code"),
        auto_include_new_instances: row.get("auto_include_new_instances"),
        created_by: row.get("created_by"),
        updated_by: row.get("updated_by"),
        created_at: row.get("created_at"),
        updated_at: row.get("updated_at"),
    })
}

fn map_catalog_cache(
    row: sqlx::postgres::PgRow,
) -> Result<domain::ModelProviderCatalogCacheRecord> {
    PgModelProviderMapper::to_catalog_cache_record(StoredModelProviderCatalogCacheRow {
        provider_instance_id: row.get("provider_instance_id"),
        model_discovery_mode: row.get("model_discovery_mode"),
        refresh_status: row.get("refresh_status"),
        source: row.get("source"),
        models_json: row.get("models_json"),
        last_error_message: row.get("last_error_message"),
        refreshed_at: row.get("refreshed_at"),
        updated_at: row.get("updated_at"),
    })
}

fn map_secret(row: sqlx::postgres::PgRow) -> Result<domain::ModelProviderSecretRecord> {
    PgModelProviderMapper::to_secret_record(StoredModelProviderSecretRow {
        provider_instance_id: row.get("provider_instance_id"),
        encrypted_secret_json: row.get("encrypted_secret_json"),
        secret_version: row.get("secret_version"),
        updated_at: row.get("updated_at"),
    })
}

fn map_preview_session(
    row: sqlx::postgres::PgRow,
) -> Result<domain::ModelProviderPreviewSessionRecord> {
    PgModelProviderMapper::to_preview_session_record(StoredModelProviderPreviewSessionRow {
        id: row.get("id"),
        workspace_id: row.get("workspace_id"),
        actor_user_id: row.get("actor_user_id"),
        installation_id: row.get("installation_id"),
        instance_id: row.get("instance_id"),
        config_fingerprint: row.get("config_fingerprint"),
        models_json: row.get("models_json"),
        expires_at: row.get("expires_at"),
        created_at: row.get("created_at"),
    })
}

fn map_catalog_source(
    row: sqlx::postgres::PgRow,
) -> Result<domain::ModelProviderCatalogSourceRecord> {
    Ok(domain::ModelProviderCatalogSourceRecord {
        id: row.get("id"),
        workspace_id: row.get("workspace_id"),
        source_kind: row.get("source_kind"),
        plugin_id: row.get("plugin_id"),
        provider_code: row.get("provider_code"),
        display_name: row.get("display_name"),
        base_url_ref: row.get("base_url_ref"),
        auth_secret_ref: row.get("auth_secret_ref"),
        protocol: row.get("protocol"),
        status: row.get("status"),
        last_sync_run_id: row.get("last_sync_run_id"),
        created_at: row.get("created_at"),
        updated_at: row.get("updated_at"),
    })
}

fn map_catalog_sync_run(row: sqlx::postgres::PgRow) -> Result<domain::ModelCatalogSyncRunRecord> {
    Ok(domain::ModelCatalogSyncRunRecord {
        id: row.get("id"),
        catalog_source_id: row.get("catalog_source_id"),
        status: row.get("status"),
        error_message_ref: row.get("error_message_ref"),
        discovered_count: row.get("discovered_count"),
        imported_count: row.get("imported_count"),
        disabled_count: row.get("disabled_count"),
        started_at: row.get("started_at"),
        finished_at: row.get("finished_at"),
    })
}

fn map_catalog_entry(
    row: sqlx::postgres::PgRow,
) -> Result<domain::ModelProviderCatalogEntryRecord> {
    Ok(domain::ModelProviderCatalogEntryRecord {
        id: row.get("id"),
        provider_instance_id: row.get("provider_instance_id"),
        catalog_source_id: row.get("catalog_source_id"),
        upstream_model_id: row.get("upstream_model_id"),
        display_label: row.get("display_label"),
        protocol: row.get("protocol"),
        capability_snapshot: row.get("capability_snapshot"),
        parameter_schema_ref: row.get("parameter_schema_ref"),
        context_window: row.get("context_window"),
        max_output_tokens: row.get("max_output_tokens"),
        pricing_ref: row.get("pricing_ref"),
        fetched_at: row.get("fetched_at"),
        status: row.get("status"),
    })
}

fn map_failover_queue_template(
    row: sqlx::postgres::PgRow,
) -> Result<domain::ModelFailoverQueueTemplateRecord> {
    Ok(domain::ModelFailoverQueueTemplateRecord {
        id: row.get("id"),
        workspace_id: row.get("workspace_id"),
        name: row.get("name"),
        version: row.get("version"),
        status: row.get("status"),
        created_by: row.get("created_by"),
        created_at: row.get("created_at"),
        updated_at: row.get("updated_at"),
    })
}

fn map_failover_queue_item(
    row: sqlx::postgres::PgRow,
) -> Result<domain::ModelFailoverQueueItemRecord> {
    Ok(domain::ModelFailoverQueueItemRecord {
        id: row.get("id"),
        queue_template_id: row.get("queue_template_id"),
        sort_index: row.get("sort_index"),
        provider_instance_id: row.get("provider_instance_id"),
        provider_code: row.get("provider_code"),
        upstream_model_id: row.get("upstream_model_id"),
        protocol: row.get("protocol"),
        enabled: row.get("enabled"),
    })
}

fn map_failover_queue_snapshot(
    row: sqlx::postgres::PgRow,
) -> Result<domain::ModelFailoverQueueSnapshotRecord> {
    Ok(domain::ModelFailoverQueueSnapshotRecord {
        id: row.get("id"),
        queue_template_id: row.get("queue_template_id"),
        version: row.get("version"),
        items: row.get("items"),
        created_at: row.get("created_at"),
    })
}

#[async_trait]
impl ModelProviderRepository for PgControlPlaneStore {
    async fn create_instance(
        &self,
        input: &CreateModelProviderInstanceInput,
    ) -> Result<domain::ModelProviderInstanceRecord> {
        let row = sqlx::query(
            r#"
            insert into model_provider_instances (
                id,
                workspace_id,
                installation_id,
                provider_code,
                protocol,
                display_name,
                status,
                config_json,
                configured_models_json,
                enabled_model_ids,
                included_in_main,
                created_by,
                updated_by
            ) values (
                $1,
                $2,
                $3,
                $4,
                $5,
                $6,
                $7,
                $8,
                $9,
                $10,
                coalesce(
                    $11,
                    (
                        select auto_include_new_instances
                        from model_provider_main_instances
                        where workspace_id = $2
                          and provider_code = $4
                    ),
                    true
                ),
                $12,
                $12
            )
            returning
                id,
                workspace_id,
                installation_id,
                provider_code,
                protocol,
                display_name,
                status,
                config_json,
                configured_models_json,
                enabled_model_ids,
                included_in_main,
                created_by,
                updated_by,
                created_at,
                updated_at
            "#,
        )
        .bind(input.instance_id)
        .bind(input.workspace_id)
        .bind(input.installation_id)
        .bind(&input.provider_code)
        .bind(&input.protocol)
        .bind(&input.display_name)
        .bind(input.status.as_str())
        .bind(&input.config_json)
        .bind(serde_json::to_value(&input.configured_models)?)
        .bind(&input.enabled_model_ids)
        .bind(input.included_in_main)
        .bind(input.created_by)
        .fetch_one(self.pool())
        .await?;

        map_instance(row)
    }

    async fn update_instance(
        &self,
        input: &UpdateModelProviderInstanceInput,
    ) -> Result<domain::ModelProviderInstanceRecord> {
        let row = sqlx::query(
            r#"
            update model_provider_instances
            set
                display_name = $3,
                status = $4,
                config_json = $5,
                configured_models_json = $6,
                enabled_model_ids = $7,
                included_in_main = $8,
                updated_by = $9,
                updated_at = now()
            where workspace_id = $1
              and id = $2
            returning
                id,
                workspace_id,
                installation_id,
                provider_code,
                protocol,
                display_name,
                status,
                config_json,
                configured_models_json,
                enabled_model_ids,
                included_in_main,
                created_by,
                updated_by,
                created_at,
                updated_at
            "#,
        )
        .bind(input.workspace_id)
        .bind(input.instance_id)
        .bind(&input.display_name)
        .bind(input.status.as_str())
        .bind(&input.config_json)
        .bind(serde_json::to_value(&input.configured_models)?)
        .bind(&input.enabled_model_ids)
        .bind(input.included_in_main)
        .bind(input.updated_by)
        .fetch_optional(self.pool())
        .await?;

        match row {
            Some(row) => map_instance(row),
            None => bail!(ControlPlaneError::NotFound("model_provider_instance")),
        }
    }

    async fn get_instance(
        &self,
        workspace_id: Uuid,
        instance_id: Uuid,
    ) -> Result<Option<domain::ModelProviderInstanceRecord>> {
        let row = sqlx::query(
            r#"
            select
                id,
                workspace_id,
                installation_id,
                provider_code,
                protocol,
                display_name,
                status,
                config_json,
                configured_models_json,
                enabled_model_ids,
                included_in_main,
                created_by,
                updated_by,
                created_at,
                updated_at
            from model_provider_instances
            where workspace_id = $1
              and id = $2
            "#,
        )
        .bind(workspace_id)
        .bind(instance_id)
        .fetch_optional(self.pool())
        .await?;

        row.map(map_instance).transpose()
    }

    async fn list_instances(
        &self,
        workspace_id: Uuid,
    ) -> Result<Vec<domain::ModelProviderInstanceRecord>> {
        let rows = sqlx::query(
            r#"
            select
                id,
                workspace_id,
                installation_id,
                provider_code,
                protocol,
                display_name,
                status,
                config_json,
                configured_models_json,
                enabled_model_ids,
                included_in_main,
                created_by,
                updated_by,
                created_at,
                updated_at
            from model_provider_instances
            where workspace_id = $1
            order by updated_at desc, id desc
            "#,
        )
        .bind(workspace_id)
        .fetch_all(self.pool())
        .await?;

        rows.into_iter().map(map_instance).collect()
    }

    async fn list_instances_by_provider_code(
        &self,
        provider_code: &str,
    ) -> Result<Vec<domain::ModelProviderInstanceRecord>> {
        let rows = sqlx::query(
            r#"
            select
                id,
                workspace_id,
                installation_id,
                provider_code,
                protocol,
                display_name,
                status,
                config_json,
                configured_models_json,
                enabled_model_ids,
                included_in_main,
                created_by,
                updated_by,
                created_at,
                updated_at
            from model_provider_instances
            where provider_code = $1
            order by updated_at desc, id desc
            "#,
        )
        .bind(provider_code)
        .fetch_all(self.pool())
        .await?;

        rows.into_iter().map(map_instance).collect()
    }

    async fn reassign_instances_to_installation(
        &self,
        input: &ReassignModelProviderInstancesInput,
    ) -> Result<Vec<domain::ModelProviderInstanceRecord>> {
        let rows = sqlx::query(
            r#"
            update model_provider_instances
            set
                installation_id = $3,
                protocol = $4,
                updated_by = $5,
                updated_at = now()
            where workspace_id = $1
              and provider_code = $2
            returning
                id,
                workspace_id,
                installation_id,
                provider_code,
                protocol,
                display_name,
                status,
                config_json,
                configured_models_json,
                enabled_model_ids,
                included_in_main,
                created_by,
                updated_by,
                created_at,
                updated_at
            "#,
        )
        .bind(input.workspace_id)
        .bind(&input.provider_code)
        .bind(input.target_installation_id)
        .bind(&input.target_protocol)
        .bind(input.updated_by)
        .fetch_all(self.pool())
        .await?;

        rows.into_iter().map(map_instance).collect()
    }

    async fn upsert_catalog_cache(
        &self,
        input: &UpsertModelProviderCatalogCacheInput,
    ) -> Result<domain::ModelProviderCatalogCacheRecord> {
        let row = sqlx::query(
            r#"
            insert into provider_instance_model_catalog_cache (
                provider_instance_id,
                model_discovery_mode,
                refresh_status,
                source,
                models_json,
                last_error_message,
                refreshed_at
            ) values ($1, $2, $3, $4, $5, $6, $7)
            on conflict (provider_instance_id) do update
            set
                model_discovery_mode = excluded.model_discovery_mode,
                refresh_status = excluded.refresh_status,
                source = excluded.source,
                models_json = excluded.models_json,
                last_error_message = excluded.last_error_message,
                refreshed_at = excluded.refreshed_at,
                updated_at = now()
            returning
                provider_instance_id,
                model_discovery_mode,
                refresh_status,
                source,
                models_json,
                last_error_message,
                refreshed_at,
                updated_at
            "#,
        )
        .bind(input.provider_instance_id)
        .bind(input.model_discovery_mode.as_str())
        .bind(input.refresh_status.as_str())
        .bind(input.source.as_str())
        .bind(&input.models_json)
        .bind(input.last_error_message.as_deref())
        .bind(input.refreshed_at)
        .fetch_one(self.pool())
        .await?;

        map_catalog_cache(row)
    }

    async fn get_catalog_cache(
        &self,
        provider_instance_id: Uuid,
    ) -> Result<Option<domain::ModelProviderCatalogCacheRecord>> {
        let row = sqlx::query(
            r#"
            select
                provider_instance_id,
                model_discovery_mode,
                refresh_status,
                source,
                models_json,
                last_error_message,
                refreshed_at,
                updated_at
            from provider_instance_model_catalog_cache
            where provider_instance_id = $1
            "#,
        )
        .bind(provider_instance_id)
        .fetch_optional(self.pool())
        .await?;

        row.map(map_catalog_cache).transpose()
    }

    async fn upsert_secret(
        &self,
        input: &UpsertModelProviderSecretInput,
    ) -> Result<domain::ModelProviderSecretRecord> {
        let encrypted_secret_json =
            encrypt_secret_json(&input.plaintext_secret_json, &input.master_key)?;
        let row = sqlx::query(
            r#"
            insert into model_provider_instance_secrets (
                provider_instance_id,
                encrypted_secret_json,
                secret_version
            ) values ($1, $2, $3)
            on conflict (provider_instance_id) do update
            set
                encrypted_secret_json = excluded.encrypted_secret_json,
                secret_version = excluded.secret_version,
                updated_at = now()
            returning provider_instance_id, encrypted_secret_json, secret_version, updated_at
            "#,
        )
        .bind(input.provider_instance_id)
        .bind(&encrypted_secret_json)
        .bind(input.secret_version)
        .fetch_one(self.pool())
        .await?;

        map_secret(row)
    }

    async fn upsert_main_instance(
        &self,
        input: &UpsertModelProviderMainInstanceInput,
    ) -> Result<domain::ModelProviderMainInstanceRecord> {
        let row = sqlx::query(
            r#"
            insert into model_provider_main_instances (
                workspace_id,
                provider_code,
                auto_include_new_instances,
                created_by,
                updated_by
            ) values ($1, $2, $3, $4, $4)
            on conflict (workspace_id, provider_code) do update
            set
                auto_include_new_instances = excluded.auto_include_new_instances,
                updated_by = excluded.updated_by,
                updated_at = now()
            returning
                workspace_id,
                provider_code,
                auto_include_new_instances,
                created_by,
                updated_by,
                created_at,
                updated_at
            "#,
        )
        .bind(input.workspace_id)
        .bind(&input.provider_code)
        .bind(input.auto_include_new_instances)
        .bind(input.updated_by)
        .fetch_one(self.pool())
        .await?;

        map_main_instance(row)
    }

    async fn get_main_instance(
        &self,
        workspace_id: Uuid,
        provider_code: &str,
    ) -> Result<Option<domain::ModelProviderMainInstanceRecord>> {
        let row = sqlx::query(
            r#"
            select
                workspace_id,
                provider_code,
                auto_include_new_instances,
                created_by,
                updated_by,
                created_at,
                updated_at
            from model_provider_main_instances
            where workspace_id = $1
              and provider_code = $2
            "#,
        )
        .bind(workspace_id)
        .bind(provider_code)
        .fetch_optional(self.pool())
        .await?;

        row.map(map_main_instance).transpose()
    }

    async fn create_preview_session(
        &self,
        input: &CreateModelProviderPreviewSessionInput,
    ) -> Result<domain::ModelProviderPreviewSessionRecord> {
        let row = sqlx::query(
            r#"
            insert into model_provider_preview_sessions (
                id,
                workspace_id,
                actor_user_id,
                installation_id,
                instance_id,
                config_fingerprint,
                models_json,
                expires_at
            ) values ($1, $2, $3, $4, $5, $6, $7, $8)
            returning
                id,
                workspace_id,
                actor_user_id,
                installation_id,
                instance_id,
                config_fingerprint,
                models_json,
                expires_at,
                created_at
            "#,
        )
        .bind(input.session_id)
        .bind(input.workspace_id)
        .bind(input.actor_user_id)
        .bind(input.installation_id)
        .bind(input.instance_id)
        .bind(&input.config_fingerprint)
        .bind(&input.models_json)
        .bind(input.expires_at)
        .fetch_one(self.pool())
        .await?;

        map_preview_session(row)
    }

    async fn get_preview_session(
        &self,
        workspace_id: Uuid,
        session_id: Uuid,
    ) -> Result<Option<domain::ModelProviderPreviewSessionRecord>> {
        let row = sqlx::query(
            r#"
            select
                id,
                workspace_id,
                actor_user_id,
                installation_id,
                instance_id,
                config_fingerprint,
                models_json,
                expires_at,
                created_at
            from model_provider_preview_sessions
            where workspace_id = $1
              and id = $2
            "#,
        )
        .bind(workspace_id)
        .bind(session_id)
        .fetch_optional(self.pool())
        .await?;

        row.map(map_preview_session).transpose()
    }

    async fn delete_preview_session(&self, workspace_id: Uuid, session_id: Uuid) -> Result<()> {
        sqlx::query(
            r#"
            delete from model_provider_preview_sessions
            where workspace_id = $1
              and id = $2
            "#,
        )
        .bind(workspace_id)
        .bind(session_id)
        .execute(self.pool())
        .await?;
        Ok(())
    }

    async fn get_secret_json(
        &self,
        provider_instance_id: Uuid,
        master_key: &str,
    ) -> Result<Option<serde_json::Value>> {
        let row = sqlx::query(
            r#"
            select provider_instance_id, encrypted_secret_json, secret_version, updated_at
            from model_provider_instance_secrets
            where provider_instance_id = $1
            "#,
        )
        .bind(provider_instance_id)
        .fetch_optional(self.pool())
        .await?;

        row.map(|row| -> Result<Value> {
            let record = map_secret(row)?;
            decrypt_secret_json(&record.encrypted_secret_json, master_key)
        })
        .transpose()
    }

    async fn get_secret_record(
        &self,
        provider_instance_id: Uuid,
    ) -> Result<Option<domain::ModelProviderSecretRecord>> {
        let row = sqlx::query(
            r#"
            select provider_instance_id, encrypted_secret_json, secret_version, updated_at
            from model_provider_instance_secrets
            where provider_instance_id = $1
            "#,
        )
        .bind(provider_instance_id)
        .fetch_optional(self.pool())
        .await?;

        row.map(map_secret).transpose()
    }

    async fn delete_instance(&self, workspace_id: Uuid, instance_id: Uuid) -> Result<()> {
        let deleted = sqlx::query_scalar::<_, Uuid>(
            r#"
            delete from model_provider_instances
            where workspace_id = $1
              and id = $2
            returning id
            "#,
        )
        .bind(workspace_id)
        .bind(instance_id)
        .fetch_optional(self.pool())
        .await?;

        if deleted.is_some() {
            Ok(())
        } else {
            bail!(ControlPlaneError::NotFound("model_provider_instance"));
        }
    }

    async fn count_instance_references(
        &self,
        workspace_id: Uuid,
        instance_id: Uuid,
    ) -> Result<u64> {
        let pattern = format!("%{instance_id}%");
        let count: i64 = sqlx::query_scalar(
            r#"
            select count(*)::bigint
            from (
                select 1
                from flow_drafts fd
                join flows f on f.id = fd.flow_id
                join applications a on a.id = f.application_id
                where a.workspace_id = $1
                  and fd.document::text like $2
                union all
                select 1
                from flow_versions fv
                join flows f on f.id = fv.flow_id
                join applications a on a.id = f.application_id
                where a.workspace_id = $1
                  and fv.document::text like $2
            ) refs
            "#,
        )
        .bind(workspace_id)
        .bind(pattern)
        .fetch_one(self.pool())
        .await?;

        Ok(count as u64)
    }

    async fn create_catalog_source(
        &self,
        input: &CreateModelProviderCatalogSourceInput,
    ) -> Result<domain::ModelProviderCatalogSourceRecord> {
        let row = sqlx::query(
            r#"
            insert into model_provider_catalog_sources (
                id,
                workspace_id,
                source_kind,
                plugin_id,
                provider_code,
                display_name,
                base_url_ref,
                auth_secret_ref,
                protocol,
                status
            ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            returning
                id,
                workspace_id,
                source_kind,
                plugin_id,
                provider_code,
                display_name,
                base_url_ref,
                auth_secret_ref,
                protocol,
                status,
                last_sync_run_id,
                created_at,
                updated_at
            "#,
        )
        .bind(input.source_id)
        .bind(input.workspace_id)
        .bind(&input.source_kind)
        .bind(&input.plugin_id)
        .bind(&input.provider_code)
        .bind(&input.display_name)
        .bind(input.base_url_ref.as_deref())
        .bind(input.auth_secret_ref.as_deref())
        .bind(&input.protocol)
        .bind(&input.status)
        .fetch_one(self.pool())
        .await?;

        map_catalog_source(row)
    }

    async fn create_catalog_sync_run(
        &self,
        input: &CreateModelCatalogSyncRunInput,
    ) -> Result<domain::ModelCatalogSyncRunRecord> {
        let mut tx = self.pool().begin().await?;
        let row = sqlx::query(
            r#"
            insert into model_catalog_sync_runs (
                id,
                catalog_source_id,
                status,
                error_message_ref,
                discovered_count,
                imported_count,
                disabled_count,
                started_at,
                finished_at
            ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            returning
                id,
                catalog_source_id,
                status,
                error_message_ref,
                discovered_count,
                imported_count,
                disabled_count,
                started_at,
                finished_at
            "#,
        )
        .bind(input.sync_run_id)
        .bind(input.catalog_source_id)
        .bind(&input.status)
        .bind(input.error_message_ref.as_deref())
        .bind(input.discovered_count)
        .bind(input.imported_count)
        .bind(input.disabled_count)
        .bind(input.started_at)
        .bind(input.finished_at)
        .fetch_one(&mut *tx)
        .await?;

        sqlx::query(
            r#"
            update model_provider_catalog_sources
            set last_sync_run_id = $1,
                updated_at = now()
            where id = $2
            "#,
        )
        .bind(input.sync_run_id)
        .bind(input.catalog_source_id)
        .execute(&mut *tx)
        .await?;

        tx.commit().await?;
        map_catalog_sync_run(row)
    }

    async fn upsert_catalog_entry(
        &self,
        input: &UpsertModelProviderCatalogEntryInput,
    ) -> Result<domain::ModelProviderCatalogEntryRecord> {
        let row = sqlx::query(
            r#"
            insert into model_provider_catalog_entries (
                id,
                provider_instance_id,
                catalog_source_id,
                upstream_model_id,
                display_label,
                protocol,
                capability_snapshot,
                parameter_schema_ref,
                context_window,
                max_output_tokens,
                pricing_ref,
                status
            ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
            on conflict (catalog_source_id, upstream_model_id, protocol) do update
            set
                provider_instance_id = excluded.provider_instance_id,
                display_label = excluded.display_label,
                capability_snapshot = excluded.capability_snapshot,
                parameter_schema_ref = excluded.parameter_schema_ref,
                context_window = excluded.context_window,
                max_output_tokens = excluded.max_output_tokens,
                pricing_ref = excluded.pricing_ref,
                fetched_at = now(),
                status = excluded.status
            returning
                id,
                provider_instance_id,
                catalog_source_id,
                upstream_model_id,
                display_label,
                protocol,
                capability_snapshot,
                parameter_schema_ref,
                context_window,
                max_output_tokens,
                pricing_ref,
                fetched_at,
                status
            "#,
        )
        .bind(Uuid::now_v7())
        .bind(input.provider_instance_id)
        .bind(input.catalog_source_id)
        .bind(&input.upstream_model_id)
        .bind(&input.display_label)
        .bind(&input.protocol)
        .bind(&input.capability_snapshot)
        .bind(input.parameter_schema_ref.as_deref())
        .bind(input.context_window)
        .bind(input.max_output_tokens)
        .bind(input.pricing_ref.as_deref())
        .bind(&input.status)
        .fetch_one(self.pool())
        .await?;

        map_catalog_entry(row)
    }

    async fn list_catalog_entries(
        &self,
        catalog_source_id: Uuid,
    ) -> Result<Vec<domain::ModelProviderCatalogEntryRecord>> {
        let rows = sqlx::query(
            r#"
            select
                id,
                provider_instance_id,
                catalog_source_id,
                upstream_model_id,
                display_label,
                protocol,
                capability_snapshot,
                parameter_schema_ref,
                context_window,
                max_output_tokens,
                pricing_ref,
                fetched_at,
                status
            from model_provider_catalog_entries
            where catalog_source_id = $1
            order by upstream_model_id asc, protocol asc
            "#,
        )
        .bind(catalog_source_id)
        .fetch_all(self.pool())
        .await?;

        rows.into_iter().map(map_catalog_entry).collect()
    }

    async fn list_catalog_entries_for_provider_instance(
        &self,
        provider_instance_id: Uuid,
    ) -> Result<Vec<domain::ModelProviderCatalogEntryRecord>> {
        let rows = sqlx::query(
            r#"
            select
                id,
                provider_instance_id,
                catalog_source_id,
                upstream_model_id,
                display_label,
                protocol,
                capability_snapshot,
                parameter_schema_ref,
                context_window,
                max_output_tokens,
                pricing_ref,
                fetched_at,
                status
            from model_provider_catalog_entries
            where provider_instance_id = $1
            order by upstream_model_id asc, protocol asc
            "#,
        )
        .bind(provider_instance_id)
        .fetch_all(self.pool())
        .await?;

        rows.into_iter().map(map_catalog_entry).collect()
    }

    async fn create_failover_queue_template(
        &self,
        input: &CreateModelFailoverQueueTemplateInput,
    ) -> Result<domain::ModelFailoverQueueTemplateRecord> {
        let row = sqlx::query(
            r#"
            insert into model_failover_queue_templates (
                id,
                workspace_id,
                name,
                version,
                status,
                created_by
            ) values ($1, $2, $3, $4, $5, $6)
            returning
                id,
                workspace_id,
                name,
                version,
                status,
                created_by,
                created_at,
                updated_at
            "#,
        )
        .bind(input.queue_template_id)
        .bind(input.workspace_id)
        .bind(&input.name)
        .bind(input.version)
        .bind(&input.status)
        .bind(input.created_by)
        .fetch_one(self.pool())
        .await?;

        map_failover_queue_template(row)
    }

    async fn get_failover_queue_template(
        &self,
        queue_template_id: Uuid,
    ) -> Result<Option<domain::ModelFailoverQueueTemplateRecord>> {
        let row = sqlx::query(
            r#"
            select
                id,
                workspace_id,
                name,
                version,
                status,
                created_by,
                created_at,
                updated_at
            from model_failover_queue_templates
            where id = $1
            "#,
        )
        .bind(queue_template_id)
        .fetch_optional(self.pool())
        .await?;

        row.map(map_failover_queue_template).transpose()
    }

    async fn create_failover_queue_item(
        &self,
        input: &CreateModelFailoverQueueItemInput,
    ) -> Result<domain::ModelFailoverQueueItemRecord> {
        let row = sqlx::query(
            r#"
            insert into model_failover_queue_items (
                id,
                queue_template_id,
                sort_index,
                provider_instance_id,
                provider_code,
                upstream_model_id,
                protocol,
                enabled
            ) values ($1, $2, $3, $4, $5, $6, $7, $8)
            returning
                id,
                queue_template_id,
                sort_index,
                provider_instance_id,
                provider_code,
                upstream_model_id,
                protocol,
                enabled
            "#,
        )
        .bind(input.queue_item_id)
        .bind(input.queue_template_id)
        .bind(input.sort_index)
        .bind(input.provider_instance_id)
        .bind(&input.provider_code)
        .bind(&input.upstream_model_id)
        .bind(&input.protocol)
        .bind(input.enabled)
        .fetch_one(self.pool())
        .await?;

        map_failover_queue_item(row)
    }

    async fn list_failover_queue_items(
        &self,
        queue_template_id: Uuid,
    ) -> Result<Vec<domain::ModelFailoverQueueItemRecord>> {
        let rows = sqlx::query(
            r#"
            select
                id,
                queue_template_id,
                sort_index,
                provider_instance_id,
                provider_code,
                upstream_model_id,
                protocol,
                enabled
            from model_failover_queue_items
            where queue_template_id = $1
            order by sort_index asc, id asc
            "#,
        )
        .bind(queue_template_id)
        .fetch_all(self.pool())
        .await?;

        rows.into_iter().map(map_failover_queue_item).collect()
    }

    async fn create_failover_queue_snapshot(
        &self,
        input: &CreateModelFailoverQueueSnapshotInput,
    ) -> Result<domain::ModelFailoverQueueSnapshotRecord> {
        let row = sqlx::query(
            r#"
            insert into model_failover_queue_snapshots (
                id,
                queue_template_id,
                version,
                items
            ) values ($1, $2, $3, $4)
            returning
                id,
                queue_template_id,
                version,
                items,
                created_at
            "#,
        )
        .bind(input.snapshot_id)
        .bind(input.queue_template_id)
        .bind(input.version)
        .bind(&input.items)
        .fetch_one(self.pool())
        .await?;

        map_failover_queue_snapshot(row)
    }

    async fn list_failover_queue_snapshots(
        &self,
        queue_template_id: Uuid,
    ) -> Result<Vec<domain::ModelFailoverQueueSnapshotRecord>> {
        let rows = sqlx::query(
            r#"
            select
                id,
                queue_template_id,
                version,
                items,
                created_at
            from model_failover_queue_snapshots
            where queue_template_id = $1
            order by created_at desc, id desc
            "#,
        )
        .bind(queue_template_id)
        .fetch_all(self.pool())
        .await?;

        rows.into_iter().map(map_failover_queue_snapshot).collect()
    }
}

fn encrypt_secret_json(secret_json: &Value, master_key: &str) -> Result<Value> {
    if master_key.is_empty() {
        bail!(ControlPlaneError::InvalidInput(
            "provider_secret_master_key"
        ));
    }

    let plaintext = serde_json::to_vec(secret_json)?;
    Ok(json!({
        "algorithm": "xor_v1",
        "ciphertext": xor_hex(&plaintext, master_key.as_bytes()),
    }))
}

fn decrypt_secret_json(encrypted_secret_json: &Value, master_key: &str) -> Result<Value> {
    if master_key.is_empty() {
        bail!(ControlPlaneError::InvalidInput(
            "provider_secret_master_key"
        ));
    }

    let algorithm = encrypted_secret_json
        .get("algorithm")
        .and_then(Value::as_str)
        .ok_or_else(|| anyhow!("missing secret encryption algorithm"))?;
    if algorithm != "xor_v1" {
        bail!(anyhow!(
            "unsupported secret encryption algorithm: {algorithm}"
        ));
    }
    let ciphertext = encrypted_secret_json
        .get("ciphertext")
        .and_then(Value::as_str)
        .ok_or_else(|| anyhow!("missing secret ciphertext"))?;
    let plaintext = xor_hex_decode(ciphertext, master_key.as_bytes())?;
    Ok(serde_json::from_slice(&plaintext)?)
}

fn xor_hex(bytes: &[u8], key: &[u8]) -> String {
    bytes
        .iter()
        .enumerate()
        .map(|(index, byte)| format!("{:02x}", byte ^ key[index % key.len()]))
        .collect::<String>()
}

fn xor_hex_decode(ciphertext: &str, key: &[u8]) -> Result<Vec<u8>> {
    if !ciphertext.len().is_multiple_of(2) {
        bail!(anyhow!("invalid ciphertext length"));
    }

    let mut encrypted = Vec::with_capacity(ciphertext.len() / 2);
    let mut chars = ciphertext.as_bytes().chunks_exact(2);
    for chunk in &mut chars {
        let pair = std::str::from_utf8(chunk)?;
        encrypted.push(u8::from_str_radix(pair, 16)?);
    }

    Ok(encrypted
        .into_iter()
        .enumerate()
        .map(|(index, byte)| byte ^ key[index % key.len()])
        .collect())
}
