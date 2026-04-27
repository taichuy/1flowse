use control_plane::orchestration_runtime::{
    ContinueFlowDebugRunCommand, OrchestrationRuntimeService, StartFlowDebugRunCommand,
};
use uuid::Uuid;

#[tokio::test]
async fn start_flow_debug_run_uses_request_document_snapshot() {
    let service = OrchestrationRuntimeService::for_tests();
    let seeded = service.seed_application_with_flow("Support Agent").await;

    let started = service
        .start_flow_debug_run(StartFlowDebugRunCommand {
            actor_user_id: seeded.actor_user_id,
            application_id: seeded.application_id,
            input_payload: serde_json::json!({
                "node-start": { "query": "draft prompt" }
            }),
            document_snapshot: Some(serde_json::json!({
                "schemaVersion": "1flowbase.flow/v1",
                "meta": {
                    "flowId": seeded.flow_id.to_string(),
                    "name": "Support Agent",
                    "description": "",
                    "tags": []
                },
                "graph": {
                    "nodes": [
                        {
                            "id": "node-start",
                            "type": "start",
                            "alias": "Start",
                            "description": "",
                            "containerId": null,
                            "position": { "x": 0, "y": 0 },
                            "configVersion": 1,
                            "config": {},
                            "bindings": {},
                            "outputs": [{ "key": "query", "title": "用户输入", "valueType": "string" }]
                        },
                        {
                            "id": "node-llm",
                            "type": "llm",
                            "alias": "LLM",
                            "description": "",
                            "containerId": null,
                            "position": { "x": 240, "y": 0 },
                            "configVersion": 1,
                            "config": {
                                "model_provider": {
                                    "provider_code": "fixture_provider",
                                    "source_instance_id": seeded.source_provider_instance_id.to_string(),
                                    "model_id": "gpt-5.4-mini"
                                }
                            },
                            "bindings": {
                                "user_prompt": { "kind": "templated_text", "value": "snapshot {{node-start.query}}" }
                            },
                            "outputs": [{ "key": "text", "title": "模型输出", "valueType": "string" }]
                        },
                        {
                            "id": "node-answer",
                            "type": "answer",
                            "alias": "Answer",
                            "description": "",
                            "containerId": null,
                            "position": { "x": 480, "y": 0 },
                            "configVersion": 1,
                            "config": {},
                            "bindings": {
                                "answer_template": { "kind": "templated_text", "value": "{{node-llm.text}}" }
                            },
                            "outputs": [{ "key": "answer", "title": "对话输出", "valueType": "string" }]
                        }
                    ],
                    "edges": [
                        { "id": "edge-start-llm", "source": "node-start", "target": "node-llm", "sourceHandle": null, "targetHandle": null, "containerId": null, "points": [] },
                        { "id": "edge-llm-answer", "source": "node-llm", "target": "node-answer", "sourceHandle": null, "targetHandle": null, "containerId": null, "points": [] }
                    ]
                },
                "editor": {
                    "viewport": { "x": 0, "y": 0, "zoom": 1 },
                    "annotations": [],
                    "activeContainerPath": []
                }
            })),
        })
        .await
        .unwrap();

    let detail = service
        .continue_flow_debug_run(ContinueFlowDebugRunCommand {
            application_id: seeded.application_id,
            flow_run_id: started.flow_run.id,
            workspace_id: Uuid::nil(),
        })
        .await
        .unwrap();

    assert_eq!(
        detail.flow_run.output_payload["answer"],
        serde_json::json!("echo:gpt-5.4-mini:snapshot draft prompt")
    );
}
