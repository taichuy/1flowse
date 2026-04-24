use sqlx::PgPool;
use storage_postgres::{connect, run_migrations, PgControlPlaneStore};
use uuid::Uuid;

fn base_database_url() -> String {
    std::env::var("DATABASE_URL")
        .unwrap_or_else(|_| "postgres://postgres:1flowbase@127.0.0.1:35432/1flowbase".into())
}

async fn isolated_database_url() -> String {
    let admin_pool = PgPool::connect(&base_database_url()).await.unwrap();
    let schema = format!("test_{}", Uuid::now_v7().to_string().replace('-', ""));
    sqlx::query(&format!("create schema if not exists {schema}"))
        .execute(&admin_pool)
        .await
        .unwrap();

    format!("{}?options=-csearch_path%3D{schema}", base_database_url())
}

#[tokio::test]
async fn migration_smoke_creates_auth_and_workspace_tables() {
    let pool = connect(&isolated_database_url().await).await.unwrap();
    run_migrations(&pool).await.unwrap();
    let schema: String = sqlx::query_scalar("select current_schema()")
        .fetch_one(&pool)
        .await
        .unwrap();

    let tables: Vec<String> = sqlx::query_scalar(
        r#"
        select table_name
        from information_schema.tables
        where table_schema = $1
        "#,
    )
    .bind(&schema)
    .fetch_all(&pool)
    .await
    .unwrap();

    assert!(tables.contains(&"users".to_string()));
    assert!(tables.contains(&"roles".to_string()));
    assert!(tables.contains(&"permission_definitions".to_string()));
    assert!(tables.contains(&"authenticators".to_string()));
    assert!(tables.contains(&"workspaces".to_string()));
    assert!(tables.contains(&"workspace_memberships".to_string()));
}

#[tokio::test]
async fn migration_smoke_creates_workspace_tables_and_workspace_scoped_indexes() {
    let pool = connect(&isolated_database_url().await).await.unwrap();
    run_migrations(&pool).await.unwrap();
    let store = PgControlPlaneStore::new(pool.clone());
    let schema: String = sqlx::query_scalar("select current_schema()")
        .fetch_one(&pool)
        .await
        .unwrap();
    store
        .upsert_permission_catalog(&access_control::permission_catalog())
        .await
        .unwrap();

    let tables: Vec<String> = sqlx::query_scalar(
        r#"
        select table_name
        from information_schema.tables
        where table_schema = $1
        "#,
    )
    .bind(&schema)
    .fetch_all(&pool)
    .await
    .unwrap();
    let workspace_columns: Vec<String> = sqlx::query_scalar(
        r#"
        select column_name
        from information_schema.columns
        where table_schema = $1
          and table_name = 'workspaces'
        "#,
    )
    .bind(&schema)
    .fetch_all(&pool)
    .await
    .unwrap();
    let role_columns: Vec<String> = sqlx::query_scalar(
        r#"
        select column_name
        from information_schema.columns
        where table_schema = $1
          and table_name = 'roles'
        "#,
    )
    .bind(&schema)
    .fetch_all(&pool)
    .await
    .unwrap();
    let audit_log_columns: Vec<String> = sqlx::query_scalar(
        r#"
        select column_name
        from information_schema.columns
        where table_schema = $1
          and table_name = 'audit_logs'
        "#,
    )
    .bind(&schema)
    .fetch_all(&pool)
    .await
    .unwrap();
    let root_tenant_code: Option<String> =
        sqlx::query_scalar("select code from tenants where code = 'root-tenant'")
            .fetch_optional(&pool)
            .await
            .unwrap();
    let permission_codes: Vec<String> =
        sqlx::query_scalar("select code from permission_definitions order by code")
            .fetch_all(&pool)
            .await
            .unwrap();

    assert!(tables.contains(&"tenants".to_string()));
    assert!(tables.contains(&"workspaces".to_string()));
    assert!(tables.contains(&"workspace_memberships".to_string()));
    assert!(workspace_columns.contains(&"tenant_id".to_string()));
    assert!(role_columns.contains(&"workspace_id".to_string()));
    assert!(role_columns.contains(&"auto_grant_new_permissions".to_string()));
    assert!(role_columns.contains(&"is_default_member_role".to_string()));
    assert!(audit_log_columns.contains(&"workspace_id".to_string()));
    assert!(permission_codes.contains(&"workspace.configure.all".to_string()));
    assert_eq!(root_tenant_code.as_deref(), Some("root-tenant"));
}

#[tokio::test]
async fn bootstrap_repository_upserts_password_local_and_root_user() {
    let pool = connect(&isolated_database_url().await).await.unwrap();
    run_migrations(&pool).await.unwrap();
    let store = PgControlPlaneStore::new(pool);

    let tenant = store.upsert_root_tenant().await.unwrap();
    let workspace = store
        .upsert_workspace(tenant.id, "1flowbase")
        .await
        .unwrap();
    store
        .upsert_permission_catalog(&access_control::permission_catalog())
        .await
        .unwrap();
    store.upsert_builtin_roles(workspace.id).await.unwrap();
    store
        .upsert_authenticator(&domain::AuthenticatorRecord {
            name: "password-local".into(),
            auth_type: "password-local".into(),
            title: "Password".into(),
            enabled: true,
            is_builtin: true,
            options: serde_json::json!({}),
        })
        .await
        .unwrap();
    let root = store
        .upsert_root_user(
            workspace.id,
            "root",
            "root@example.com",
            "$argon2id$v=19$m=19456,t=2,p=1$test$test",
            "Root",
            "Root",
        )
        .await
        .unwrap();

    assert_eq!(root.account, "root");
    assert!(store
        .list_permissions()
        .await
        .unwrap()
        .iter()
        .any(|permission| permission.code == "workspace.configure.all"));
    assert_eq!(
        store
            .find_authenticator("password-local")
            .await
            .unwrap()
            .unwrap()
            .name,
        "password-local"
    );
}

#[tokio::test]
async fn migration_smoke_creates_plugin_trust_columns_and_constraints() {
    let pool = connect(&isolated_database_url().await).await.unwrap();
    run_migrations(&pool).await.unwrap();
    let schema: String = sqlx::query_scalar("select current_schema()")
        .fetch_one(&pool)
        .await
        .unwrap();
    let columns: Vec<String> = sqlx::query_scalar(
        r#"
        select column_name
        from information_schema.columns
        where table_schema = $1
          and table_name = 'plugin_installations'
        "#,
    )
    .bind(&schema)
    .fetch_all(&pool)
    .await
    .unwrap();
    let task_columns: Vec<String> = sqlx::query_scalar(
        r#"
        select column_name
        from information_schema.columns
        where table_schema = $1
          and table_name = 'plugin_tasks'
        "#,
    )
    .bind(&schema)
    .fetch_all(&pool)
    .await
    .unwrap();
    let task_status_check: String = sqlx::query_scalar(
        r#"
        select pg_get_constraintdef(c.oid)
        from pg_constraint c
        join pg_class r on r.oid = c.conrelid
        join pg_namespace n on n.oid = r.relnamespace
        where n.nspname = $1
          and r.relname = 'plugin_tasks'
          and c.conname = 'plugin_tasks_status_check'
        "#,
    )
    .bind(&schema)
    .fetch_one(&pool)
    .await
    .unwrap();

    assert!(columns.contains(&"trust_level".to_string()));
    assert!(columns.contains(&"signature_algorithm".to_string()));
    assert!(columns.contains(&"signing_key_id".to_string()));
    assert!(columns.contains(&"desired_state".to_string()));
    assert!(columns.contains(&"artifact_status".to_string()));
    assert!(columns.contains(&"runtime_status".to_string()));
    assert!(columns.contains(&"availability_status".to_string()));
    assert!(columns.contains(&"package_path".to_string()));
    assert!(columns.contains(&"installed_path".to_string()));
    assert!(columns.contains(&"manifest_fingerprint".to_string()));
    assert!(columns.contains(&"last_load_error".to_string()));
    assert!(!columns.contains(&"enabled".to_string()));
    assert!(!columns.contains(&"install_path".to_string()));
    assert!(task_columns.contains(&"status".to_string()));
    assert!(task_status_check.contains("queued"));
    assert!(task_status_check.contains("succeeded"));
}
