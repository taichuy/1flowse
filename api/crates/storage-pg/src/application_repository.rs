use anyhow::Result;
use async_trait::async_trait;
use control_plane::ports::{
    ApplicationRepository, ApplicationVisibility, AuthRepository, CreateApplicationInput,
};
use sqlx::Row;
use uuid::Uuid;

use crate::{
    mappers::application_mapper::{PgApplicationMapper, StoredApplicationRow},
    repositories::{tenant_id_for_workspace, workspace_id_for_user, PgControlPlaneStore},
};

fn map_application_record(row: sqlx::postgres::PgRow) -> Result<domain::ApplicationRecord> {
    PgApplicationMapper::to_application_record(StoredApplicationRow {
        id: row.get("id"),
        workspace_id: row.get("workspace_id"),
        application_type: row.get("application_type"),
        name: row.get("name"),
        description: row.get("description"),
        icon: row.get("icon"),
        icon_type: row.get("icon_type"),
        icon_background: row.get("icon_background"),
        created_by: row.get("created_by"),
        updated_at: row.get("updated_at"),
    })
}

#[async_trait]
impl ApplicationRepository for PgControlPlaneStore {
    async fn load_actor_context_for_user(
        &self,
        actor_user_id: Uuid,
    ) -> Result<domain::ActorContext> {
        let workspace_id = workspace_id_for_user(self.pool(), actor_user_id).await?;
        let tenant_id = tenant_id_for_workspace(self.pool(), workspace_id).await?;

        AuthRepository::load_actor_context(self, actor_user_id, tenant_id, workspace_id, None).await
    }

    async fn list_applications(
        &self,
        workspace_id: Uuid,
        actor_user_id: Uuid,
        visibility: ApplicationVisibility,
    ) -> Result<Vec<domain::ApplicationRecord>> {
        let visibility_value = match visibility {
            ApplicationVisibility::Own => "own",
            ApplicationVisibility::All => "all",
        };
        let rows = sqlx::query(
            r#"
            select
                id,
                workspace_id,
                application_type,
                name,
                description,
                icon_type,
                icon,
                icon_background,
                created_by,
                updated_at
            from applications
            where workspace_id = $1
              and ($3 = 'all' or created_by = $2)
            order by updated_at desc, id desc
            "#,
        )
        .bind(workspace_id)
        .bind(actor_user_id)
        .bind(visibility_value)
        .fetch_all(self.pool())
        .await?;

        rows.into_iter().map(map_application_record).collect()
    }

    async fn create_application(
        &self,
        input: &CreateApplicationInput,
    ) -> Result<domain::ApplicationRecord> {
        let row = sqlx::query(
            r#"
            insert into applications (
                id,
                workspace_id,
                application_type,
                name,
                description,
                icon_type,
                icon,
                icon_background,
                created_by,
                updated_by
            ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $9)
            returning
                id,
                workspace_id,
                application_type,
                name,
                description,
                icon_type,
                icon,
                icon_background,
                created_by,
                updated_at
            "#,
        )
        .bind(Uuid::now_v7())
        .bind(input.workspace_id)
        .bind(input.application_type.as_str())
        .bind(&input.name)
        .bind(&input.description)
        .bind(input.icon_type.as_deref())
        .bind(input.icon.as_deref())
        .bind(input.icon_background.as_deref())
        .bind(input.actor_user_id)
        .fetch_one(self.pool())
        .await?;

        map_application_record(row)
    }

    async fn get_application(
        &self,
        workspace_id: Uuid,
        application_id: Uuid,
    ) -> Result<Option<domain::ApplicationRecord>> {
        let row = sqlx::query(
            r#"
            select
                id,
                workspace_id,
                application_type,
                name,
                description,
                icon_type,
                icon,
                icon_background,
                created_by,
                updated_at
            from applications
            where workspace_id = $1
              and id = $2
            "#,
        )
        .bind(workspace_id)
        .bind(application_id)
        .fetch_optional(self.pool())
        .await?;

        row.map(map_application_record).transpose()
    }

    async fn append_audit_log(&self, event: &domain::AuditLogRecord) -> Result<()> {
        AuthRepository::append_audit_log(self, event).await
    }
}
