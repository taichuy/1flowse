use control_plane::flow::{FlowService, SaveFlowDraftCommand};
use domain::FlowChangeKind;
use serde_json::json;
use uuid::Uuid;

#[tokio::test]
async fn get_or_create_editor_state_requires_visible_application() {
    let service = FlowService::for_tests_with_permissions(vec![
        "application.view.own",
        "application.create.all",
    ]);
    let owner_id = Uuid::now_v7();
    let other_actor_id = Uuid::now_v7();
    let application = service
        .seed_application_for_actor(owner_id, "Support Agent")
        .await
        .unwrap();

    let error = service
        .get_or_create_editor_state(other_actor_id, application.id)
        .await
        .unwrap_err();

    assert!(error.to_string().contains("permission_denied"));
}

#[tokio::test]
async fn save_draft_only_appends_history_for_logical_changes() {
    let owner_id = Uuid::now_v7();
    let service = FlowService::for_tests();
    let application = service
        .seed_application_for_actor(owner_id, "Support Agent")
        .await
        .unwrap();
    let initial = service
        .get_or_create_editor_state(owner_id, application.id)
        .await
        .unwrap();
    let mut layout_only = initial.draft.document.clone();
    layout_only["editor"]["viewport"] = json!({ "x": 240, "y": 32, "zoom": 0.8 });

    let layout_state = service
        .save_draft(SaveFlowDraftCommand {
            actor_user_id: owner_id,
            application_id: application.id,
            document: layout_only,
            change_kind: FlowChangeKind::Layout,
            summary: "viewport update".into(),
        })
        .await
        .unwrap();

    assert_eq!(layout_state.versions.len(), 1);

    let mut logical_change = layout_state.draft.document.clone();
    logical_change["graph"]["nodes"][1]["bindings"]["system_prompt"] =
        json!({ "kind": "templated_text", "value": "You are a support agent." });

    let logical_state = service
        .save_draft(SaveFlowDraftCommand {
            actor_user_id: owner_id,
            application_id: application.id,
            document: logical_change,
            change_kind: FlowChangeKind::Logical,
            summary: "update llm prompt".into(),
        })
        .await
        .unwrap();

    assert_eq!(logical_state.versions.len(), 2);
    assert_eq!(logical_state.versions[1].summary, "update llm prompt");
}
