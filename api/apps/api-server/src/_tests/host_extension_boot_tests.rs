use api_server::host_extension_boot::builtin_host_extension_ids;

#[test]
fn builtin_host_extensions_include_storage_data_file_and_model_runtime() {
    let ids = builtin_host_extension_ids();

    assert!(ids.contains(&"official.storage-host"));
    assert!(ids.contains(&"official.data-access-host"));
    assert!(ids.contains(&"official.file-management-host"));
    assert!(ids.contains(&"official.model-runtime-host"));
}
