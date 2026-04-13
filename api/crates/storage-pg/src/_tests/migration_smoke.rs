use storage_pg::{connect, run_migrations, PgControlPlaneStore};

fn database_url() -> String {
    std::env::var("DATABASE_URL")
        .unwrap_or_else(|_| "postgres://postgres:sevenflows@127.0.0.1:35432/sevenflows".into())
}

#[tokio::test]
async fn migration_smoke_creates_auth_and_team_tables() {
    let pool = connect(&database_url()).await.unwrap();
    run_migrations(&pool).await.unwrap();

    let tables: Vec<String> = sqlx::query_scalar(
        r#"
        select table_name
        from information_schema.tables
        where table_schema = 'public'
        "#,
    )
    .fetch_all(&pool)
    .await
    .unwrap();

    assert!(tables.contains(&"users".to_string()));
    assert!(tables.contains(&"roles".to_string()));
    assert!(tables.contains(&"permission_definitions".to_string()));
    assert!(tables.contains(&"authenticators".to_string()));
}

#[tokio::test]
async fn migration_smoke_creates_tenant_table_and_workspace_scope_column() {
    let pool = connect(&database_url()).await.unwrap();
    run_migrations(&pool).await.unwrap();

    let tables: Vec<String> = sqlx::query_scalar(
        r#"
        select table_name
        from information_schema.tables
        where table_schema = 'public'
        "#,
    )
    .fetch_all(&pool)
    .await
    .unwrap();
    let team_columns: Vec<String> = sqlx::query_scalar(
        r#"
        select column_name
        from information_schema.columns
        where table_schema = 'public'
          and table_name = 'teams'
        "#,
    )
    .fetch_all(&pool)
    .await
    .unwrap();
    let root_tenant_code: Option<String> =
        sqlx::query_scalar("select code from tenants where code = 'root-tenant'")
            .fetch_optional(&pool)
            .await
            .unwrap();

    assert!(tables.contains(&"tenants".to_string()));
    assert!(team_columns.contains(&"tenant_id".to_string()));
    assert_eq!(root_tenant_code.as_deref(), Some("root-tenant"));
}

#[tokio::test]
async fn bootstrap_repository_upserts_password_local_and_root_user() {
    let pool = connect(&database_url()).await.unwrap();
    run_migrations(&pool).await.unwrap();
    let store = PgControlPlaneStore::new(pool);

    let tenant = store.upsert_root_tenant().await.unwrap();
    let team = store.upsert_workspace(tenant.id, "1Flowse").await.unwrap();
    store
        .upsert_permission_catalog(&access_control::permission_catalog())
        .await
        .unwrap();
    store.upsert_builtin_roles(team.id).await.unwrap();
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
            team.id,
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
        .any(|permission| permission.code == "team.configure.all"));
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
