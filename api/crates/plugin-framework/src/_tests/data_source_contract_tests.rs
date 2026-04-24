use plugin_framework::data_source_contract::DataSourceStdioMethod;

#[test]
fn data_source_stdio_methods_are_stable() {
    assert_eq!(
        serde_json::to_string(&DataSourceStdioMethod::ValidateConfig).unwrap(),
        "\"validate_config\""
    );
    assert_eq!(
        serde_json::to_string(&DataSourceStdioMethod::ImportSnapshot).unwrap(),
        "\"import_snapshot\""
    );
}
