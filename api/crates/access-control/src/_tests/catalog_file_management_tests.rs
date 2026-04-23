use access_control::permission_catalog;

#[test]
fn permission_catalog_includes_file_management_resources() {
    let codes = permission_catalog()
        .into_iter()
        .map(|permission| permission.code)
        .collect::<Vec<_>>();

    assert!(codes.contains(&"file_storage.view.all".to_string()));
    assert!(codes.contains(&"file_storage.manage.all".to_string()));
    assert!(codes.contains(&"file_table.view.all".to_string()));
    assert!(codes.contains(&"file_table.view.own".to_string()));
    assert!(codes.contains(&"file_table.create.all".to_string()));
    assert!(codes.contains(&"file_table.delete.own".to_string()));
    assert!(codes.contains(&"file_table.bind.all".to_string()));
}
