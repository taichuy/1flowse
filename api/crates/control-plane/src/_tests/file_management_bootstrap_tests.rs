use control_plane::_tests::support::MemoryProvisioningRepository;
use control_plane::file_management::{
    attachments_template_fields, CreateWorkspaceFileTableCommand, FileManagementBootstrapService,
    FileTableProvisioningService,
};
use domain::FileTableScopeKind;
use uuid::Uuid;

#[test]
fn attachments_template_fields_match_the_approved_v1_schema() {
    let codes = attachments_template_fields()
        .into_iter()
        .map(|field| field.code)
        .collect::<Vec<_>>();

    assert_eq!(
        codes,
        vec![
            "title",
            "filename",
            "extname",
            "size",
            "mimetype",
            "path",
            "meta",
            "url",
            "storage_id",
        ]
    );
}

#[tokio::test]
async fn bootstrap_creates_builtin_attachments_once() {
    let repository = MemoryProvisioningRepository::default();
    let service = FileManagementBootstrapService::new(repository.clone());

    let first = service
        .ensure_builtin_attachments(Uuid::now_v7(), Uuid::now_v7(), "attachments")
        .await
        .unwrap();
    let second = service
        .ensure_builtin_attachments(Uuid::now_v7(), first.bound_storage_id, "attachments")
        .await
        .unwrap();

    assert_eq!(first.id, second.id);
    assert_eq!(first.scope_kind, FileTableScopeKind::System);
    assert_eq!(repository.recorded_file_tables().len(), 1);
}

#[tokio::test]
async fn workspace_file_tables_reuse_the_same_template_and_default_storage() {
    let repository = MemoryProvisioningRepository::default();
    let service = FileTableProvisioningService::new(repository.clone());
    let default_storage_id = Uuid::now_v7();

    let created = service
        .create_workspace_file_table(CreateWorkspaceFileTableCommand {
            actor_user_id: Uuid::now_v7(),
            workspace_id: Uuid::now_v7(),
            code: "project_assets".into(),
            title: "Project Assets".into(),
            default_storage_id,
        })
        .await
        .unwrap();

    assert_eq!(created.scope_kind, FileTableScopeKind::Workspace);
    assert_eq!(created.bound_storage_id, default_storage_id);
    assert_eq!(repository.recorded_file_tables().len(), 1);
}
