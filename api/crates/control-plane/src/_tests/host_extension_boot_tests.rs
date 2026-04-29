use control_plane::host_extension_boot::{
    build_host_extension_load_plan, evaluate_host_extension_policy, HostExtensionBootFailurePolicy,
    HostExtensionDeploymentPolicy, HostExtensionLoadPlanItem, HostExtensionPolicyInput,
};
use plugin_framework::HostExtensionBootstrapPhase;

#[test]
fn policy_rejects_uploaded_host_extension_when_disabled() {
    let policy = HostExtensionDeploymentPolicy {
        allowed_sources: vec!["builtin".into(), "filesystem_dropin".into()],
        allow_uploaded_host_extension: false,
        allow_contract_override: vec!["storage-ephemeral".into()],
        deny_contract_override: vec!["identity".into()],
        boot_failure_policy: HostExtensionBootFailurePolicy::Unhealthy,
    };

    let error = evaluate_host_extension_policy(
        &policy,
        &HostExtensionPolicyInput {
            extension_id: "custom.uploaded-host".into(),
            source_kind: "uploaded".into(),
            overrides_contracts: vec![],
        },
    )
    .expect_err("uploaded host extension should be rejected");

    assert!(error.to_string().contains("uploaded"));
}

#[test]
fn policy_rejects_denied_contract_override() {
    let policy = HostExtensionDeploymentPolicy {
        allowed_sources: vec!["builtin".into()],
        allow_uploaded_host_extension: false,
        allow_contract_override: vec!["storage-ephemeral".into()],
        deny_contract_override: vec!["identity".into()],
        boot_failure_policy: HostExtensionBootFailurePolicy::Unhealthy,
    };

    let error = evaluate_host_extension_policy(
        &policy,
        &HostExtensionPolicyInput {
            extension_id: "custom.identity-host".into(),
            source_kind: "builtin".into(),
            overrides_contracts: vec!["identity".into()],
        },
    )
    .expect_err("identity override should be rejected");

    assert!(error.to_string().contains("identity"));
}

#[test]
fn load_plan_sorts_by_declared_dependencies() {
    let plan = build_host_extension_load_plan(vec![
        HostExtensionLoadPlanItem {
            extension_id: "official.data-access-host".into(),
            bootstrap_phase: HostExtensionBootstrapPhase::Boot,
            after: vec!["official.storage-host".into()],
        },
        HostExtensionLoadPlanItem {
            extension_id: "official.storage-host".into(),
            bootstrap_phase: HostExtensionBootstrapPhase::Boot,
            after: vec![],
        },
    ])
    .expect("load plan should sort");

    assert_eq!(plan[0].extension_id, "official.storage-host");
    assert_eq!(plan[1].extension_id, "official.data-access-host");
}

#[test]
fn load_plan_rejects_missing_dependency() {
    let error = build_host_extension_load_plan(vec![HostExtensionLoadPlanItem {
        extension_id: "official.data-access-host".into(),
        bootstrap_phase: HostExtensionBootstrapPhase::Boot,
        after: vec!["official.storage-host".into()],
    }])
    .expect_err("missing dependency should fail");

    assert!(error.to_string().contains("official.storage-host"));
}

#[test]
fn load_plan_orders_pre_state_before_boot_without_dependency_conflict() {
    let plan = build_host_extension_load_plan(vec![
        HostExtensionLoadPlanItem {
            extension_id: "official.plugin-host".into(),
            bootstrap_phase: HostExtensionBootstrapPhase::Boot,
            after: vec![],
        },
        HostExtensionLoadPlanItem {
            extension_id: "redis-infra-host".into(),
            bootstrap_phase: HostExtensionBootstrapPhase::PreState,
            after: vec![],
        },
        HostExtensionLoadPlanItem {
            extension_id: "official.file-management-host".into(),
            bootstrap_phase: HostExtensionBootstrapPhase::Boot,
            after: vec![],
        },
        HostExtensionLoadPlanItem {
            extension_id: "local-infra-host".into(),
            bootstrap_phase: HostExtensionBootstrapPhase::PreState,
            after: vec![],
        },
    ])
    .expect("load plan should sort by phase");

    let ids = plan
        .iter()
        .map(|item| item.extension_id.as_str())
        .collect::<Vec<_>>();
    assert_eq!(
        ids,
        vec![
            "local-infra-host",
            "redis-infra-host",
            "official.file-management-host",
            "official.plugin-host"
        ]
    );
}

#[test]
fn load_plan_preserves_dependencies_across_phases() {
    let plan = build_host_extension_load_plan(vec![
        HostExtensionLoadPlanItem {
            extension_id: "redis-infra-host".into(),
            bootstrap_phase: HostExtensionBootstrapPhase::PreState,
            after: vec!["official.plugin-host".into()],
        },
        HostExtensionLoadPlanItem {
            extension_id: "official.plugin-host".into(),
            bootstrap_phase: HostExtensionBootstrapPhase::Boot,
            after: vec![],
        },
    ])
    .expect("load plan should preserve dependency order");

    assert_eq!(plan[0].extension_id, "official.plugin-host");
    assert_eq!(plan[1].extension_id, "redis-infra-host");
}
