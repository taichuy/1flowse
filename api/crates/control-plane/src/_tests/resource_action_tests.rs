use control_plane::resource_action::{
    ActionDefinition, ActionHookDefinition, ActionHookResult, ActionHookStage, ActionPipeline,
    ResourceActionKernel, ResourceActionRegistry, ResourceDefinition, ResourceScopeKind,
};

fn test_kernel_with_plugins_install_handler(
    handler: impl Fn(serde_json::Value) -> serde_json::Value + Send + Sync + 'static,
) -> ResourceActionKernel {
    let mut registry = ResourceActionRegistry::default();
    registry
        .register_resource(ResourceDefinition::core("plugins", ResourceScopeKind::System))
        .unwrap();
    registry
        .register_action(ActionDefinition::core("plugins", "install"))
        .unwrap();

    let mut kernel = ResourceActionKernel::new(registry);
    kernel
        .register_json_handler("plugins", "install", move |input| {
            let output = handler(input);
            async move { Ok(output) }
        })
        .unwrap();
    kernel
}

#[test]
fn registry_rejects_duplicate_action() {
    let mut registry = ResourceActionRegistry::default();
    registry
        .register_resource(ResourceDefinition::core("plugins", ResourceScopeKind::System))
        .unwrap();
    registry
        .register_action(ActionDefinition::core("plugins", "install"))
        .unwrap();

    let err = registry
        .register_action(ActionDefinition::core("plugins", "install"))
        .unwrap_err();
    assert!(err.to_string().contains("duplicate action"));
}

#[test]
fn registry_requires_existing_resource() {
    let mut registry = ResourceActionRegistry::default();
    let err = registry
        .register_action(ActionDefinition::core("files", "upload"))
        .unwrap_err();
    assert!(err.to_string().contains("resource not registered"));
}

#[test]
fn hook_ordering_uses_stage_priority_extension_and_hook_code() {
    let hooks = vec![
        ActionHookDefinition::new(
            ActionHookStage::AfterExecute,
            0,
            "ext_b",
            "after_a",
            ActionHookResult::Continue,
        ),
        ActionHookDefinition::new(
            ActionHookStage::BeforeExecute,
            10,
            "ext_b",
            "before_b",
            ActionHookResult::Continue,
        ),
        ActionHookDefinition::new(
            ActionHookStage::BeforeExecute,
            0,
            "ext_b",
            "before_c",
            ActionHookResult::Continue,
        ),
        ActionHookDefinition::new(
            ActionHookStage::BeforeExecute,
            0,
            "ext_a",
            "before_d",
            ActionHookResult::Continue,
        ),
        ActionHookDefinition::new(
            ActionHookStage::BeforeExecute,
            0,
            "ext_a",
            "before_a",
            ActionHookResult::Continue,
        ),
        ActionHookDefinition::new(
            ActionHookStage::BeforeValidate,
            99,
            "ext_z",
            "validate_z",
            ActionHookResult::Continue,
        ),
    ];

    let pipeline = ActionPipeline::new(hooks);
    let ordered = pipeline.ordered_hooks();

    assert_eq!(
        ordered
            .iter()
            .map(|hook| hook.hook_code.as_str())
            .collect::<Vec<_>>(),
        vec![
            "validate_z",
            "before_a",
            "before_d",
            "before_c",
            "before_b",
            "after_a"
        ]
    );
}

#[test]
fn before_execute_deny_stops_execute_and_after_execute() {
    let pipeline = ActionPipeline::new(vec![
        ActionHookDefinition::new(
            ActionHookStage::BeforeExecute,
            0,
            "ext_a",
            "deny_install",
            ActionHookResult::Deny {
                code: "install_denied".to_string(),
                message: "blocked by policy".to_string(),
            },
        ),
        ActionHookDefinition::new(
            ActionHookStage::AfterExecute,
            0,
            "ext_a",
            "after_execute",
            ActionHookResult::Warning {
                code: "should_not_run".to_string(),
                message: "after_execute ran".to_string(),
            },
        ),
    ]);
    let mut executed = false;

    let outcome = pipeline.execute(|| {
        executed = true;
        "installed"
    });

    assert!(!executed);
    assert!(outcome.output.is_none());
    assert_eq!(outcome.denied.unwrap().code, "install_denied");
    assert!(outcome.warnings.is_empty());
}

#[test]
fn after_commit_warning_does_not_change_action_result() {
    let pipeline = ActionPipeline::new(vec![ActionHookDefinition::new(
        ActionHookStage::AfterCommit,
        0,
        "ext_a",
        "record_warning",
        ActionHookResult::Warning {
            code: "audit_lag".to_string(),
            message: "audit sink lagging".to_string(),
        },
    )]);

    let outcome = pipeline.execute(|| "installed");

    assert_eq!(outcome.output, Some("installed"));
    assert!(outcome.denied.is_none());
    assert_eq!(outcome.warnings.len(), 1);
    assert_eq!(outcome.warnings[0].code, "audit_lag");
}

#[tokio::test]
async fn dispatch_calls_registered_core_handler() {
    let kernel = test_kernel_with_plugins_install_handler(|input| {
        assert_eq!(input["plugin_id"], "openai_compatible@0.3.18");
        serde_json::json!({"status": "installed"})
    });

    let output = kernel
        .dispatch_json(
            "plugins",
            "install",
            serde_json::json!({"plugin_id": "openai_compatible@0.3.18"}),
        )
        .await
        .unwrap();

    assert_eq!(output["status"], "installed");
}
