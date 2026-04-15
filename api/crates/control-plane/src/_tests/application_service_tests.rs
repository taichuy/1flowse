use control_plane::application::{ApplicationService, CreateApplicationCommand};
use domain::ApplicationType;
use uuid::Uuid;

#[tokio::test]
async fn create_application_requires_application_create_all() {
    let service = ApplicationService::for_tests_with_permissions(vec!["application.view.own"]);

    let error = service
        .create_application(CreateApplicationCommand {
            actor_user_id: Uuid::nil(),
            application_type: ApplicationType::AgentFlow,
            name: "Blocked".into(),
            description: "blocked".into(),
            icon: None,
            icon_type: None,
            icon_background: None,
        })
        .await
        .unwrap_err();

    assert!(error.to_string().contains("permission_denied"));
}

#[tokio::test]
async fn list_applications_uses_own_scope_when_actor_lacks_all_scope() {
    let service = ApplicationService::for_tests_with_permissions(vec![
        "application.view.own",
        "application.create.all",
    ]);
    let mine = service
        .create_application(CreateApplicationCommand {
            actor_user_id: Uuid::nil(),
            application_type: ApplicationType::AgentFlow,
            name: "Mine".into(),
            description: "mine".into(),
            icon: None,
            icon_type: None,
            icon_background: None,
        })
        .await
        .unwrap();
    service.seed_foreign_application("Other App");

    let visible = service.list_applications(Uuid::nil()).await.unwrap();

    assert_eq!(visible.len(), 1);
    assert_eq!(visible[0].id, mine.id);
}

#[tokio::test]
async fn get_application_detail_returns_planned_future_hooks() {
    let service = ApplicationService::for_tests();
    let created = service
        .create_application(CreateApplicationCommand {
            actor_user_id: Uuid::nil(),
            application_type: ApplicationType::AgentFlow,
            name: "Detail".into(),
            description: "detail".into(),
            icon: Some("RobotOutlined".into()),
            icon_type: Some("iconfont".into()),
            icon_background: Some("#E6F7F2".into()),
        })
        .await
        .unwrap();

    let detail = service
        .get_application(Uuid::nil(), created.id)
        .await
        .unwrap();

    assert_eq!(detail.sections.orchestration.subject_kind, "agent_flow");
    assert_eq!(detail.sections.api.credentials_status, "planned");
    assert_eq!(detail.sections.logs.run_object_kind, "application_run");
    assert_eq!(
        detail.sections.monitoring.metrics_object_kind,
        "application_metrics"
    );
}
