#[test]
fn crate_name_matches_storage_postgres() {
    assert_eq!(storage_postgres::crate_name(), "storage-postgres");
}
