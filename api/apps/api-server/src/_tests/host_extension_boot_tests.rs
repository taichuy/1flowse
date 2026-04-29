use api_server::host_extension_boot::builtin_host_extension_ids;

#[test]
fn builtin_host_extensions_include_plan_f_official_hosts() {
    let ids = builtin_host_extension_ids();

    assert_eq!(
        ids,
        vec![
            "official.identity-host",
            "official.workspace-host",
            "official.plugin-host",
            "official.local-infra-host",
            "official.file-management-host",
            "official.runtime-orchestration-host",
        ]
    );
}
