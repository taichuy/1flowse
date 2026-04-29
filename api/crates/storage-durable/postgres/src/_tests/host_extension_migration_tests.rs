use sqlx::PgPool;
use storage_postgres::{
    connect,
    host_extension_migration_repository::{
        HostExtensionMigrationRepository, RecordAppliedExtensionMigrationInput,
    },
    run_migrations,
};
use uuid::Uuid;

fn base_database_url() -> String {
    std::env::var("DATABASE_URL")
        .unwrap_or_else(|_| "postgres://postgres:1flowbase@127.0.0.1:35432/1flowbase".into())
}

async fn isolated_database_url() -> String {
    let admin_pool = PgPool::connect(&base_database_url()).await.unwrap();
    let schema = format!("test_{}", Uuid::now_v7().simple());
    sqlx::query(&format!("create schema if not exists {schema}"))
        .execute(&admin_pool)
        .await
        .unwrap();

    format!("{}?options=-csearch_path%3D{schema}", base_database_url())
}

async fn repository() -> HostExtensionMigrationRepository {
    let pool = connect(&isolated_database_url().await).await.unwrap();
    run_migrations(&pool).await.unwrap();
    HostExtensionMigrationRepository::new(pool)
}

#[tokio::test]
async fn records_applied_extension_migration_with_checksum() {
    let repository = repository().await;

    let applied = repository
        .record_applied_extension_migration(&test_input("sha256:first"))
        .await
        .unwrap();
    let loaded = repository
        .get_applied_extension_migration("file-security", "0001_create_tables")
        .await
        .unwrap()
        .unwrap();

    assert_eq!(applied.id, loaded.id);
    assert_eq!(loaded.extension_id, "file-security");
    assert_eq!(loaded.plugin_version, "0.1.0");
    assert_eq!(loaded.migration_id, "0001_create_tables");
    assert_eq!(loaded.checksum, "sha256:first");
    assert_eq!(loaded.package_fingerprint, "sha256:package");
}

#[test]
fn rejects_table_names_outside_extension_namespace() {
    let err = HostExtensionMigrationRepository::ensure_extension_table_name(
        "file-security",
        "file_scan_reports",
    )
    .unwrap_err();

    assert!(err.to_string().contains("ext_file_security__"));
}

#[tokio::test]
async fn does_not_apply_same_migration_twice_when_checksum_matches() {
    let repository = repository().await;

    let first = repository
        .record_applied_extension_migration(&test_input("sha256:first"))
        .await
        .unwrap();
    let second = repository
        .record_applied_extension_migration(&test_input("sha256:first"))
        .await
        .unwrap();

    assert_eq!(first.id, second.id);
}

#[tokio::test]
async fn checksum_mismatch_returns_error() {
    let repository = repository().await;
    repository
        .record_applied_extension_migration(&test_input("sha256:first"))
        .await
        .unwrap();

    let err = repository
        .record_applied_extension_migration(&test_input("sha256:changed"))
        .await
        .unwrap_err();

    assert!(err.to_string().contains("checksum mismatch"));
}

fn test_input(checksum: &str) -> RecordAppliedExtensionMigrationInput {
    RecordAppliedExtensionMigrationInput {
        extension_id: "file-security".into(),
        plugin_version: "0.1.0".into(),
        migration_id: "0001_create_tables".into(),
        checksum: checksum.into(),
        package_fingerprint: "sha256:package".into(),
    }
}
