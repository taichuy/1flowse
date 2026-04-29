use control_plane::ports::CacheStore;
use serde_json::json;
use storage_ephemeral::{EphemeralKvStore, MokaCacheStore};
use time::Duration;

#[tokio::test]
async fn moka_cache_store_reads_writes_and_expires_json() {
    let store = MokaCacheStore::new("flowbase:test", 128);

    CacheStore::set_json(
        &store,
        "catalog:1",
        json!({ "items": 1 }),
        Some(Duration::milliseconds(30)),
    )
    .await
    .unwrap();
    assert_eq!(
        CacheStore::get_json(&store, "catalog:1").await.unwrap(),
        Some(json!({ "items": 1 }))
    );

    tokio::time::sleep(std::time::Duration::from_millis(80)).await;
    assert_eq!(
        CacheStore::get_json(&store, "catalog:1").await.unwrap(),
        None
    );
}

#[tokio::test]
async fn moka_cache_store_does_not_make_non_positive_ttl_immortal() {
    let store = MokaCacheStore::new("flowbase:test", 128);

    CacheStore::set_json(
        &store,
        "expired",
        json!({ "value": true }),
        Some(Duration::seconds(-1)),
    )
    .await
    .unwrap();

    assert_eq!(CacheStore::get_json(&store, "expired").await.unwrap(), None);

    assert!(EphemeralKvStore::set_if_absent_json(
        &store,
        "lease",
        json!({ "owner": "a" }),
        Some(Duration::ZERO),
    )
    .await
    .unwrap());
    assert_eq!(CacheStore::get_json(&store, "lease").await.unwrap(), None);
}

#[tokio::test]
async fn moka_cache_store_touch_with_non_positive_ttl_clears_entry() {
    let store = MokaCacheStore::new("flowbase:test", 128);

    CacheStore::set_json(&store, "manifest:1", json!({ "parsed": true }), None)
        .await
        .unwrap();

    assert!(!CacheStore::touch(&store, "manifest:1", Duration::ZERO)
        .await
        .unwrap());
    assert_eq!(
        CacheStore::get_json(&store, "manifest:1").await.unwrap(),
        None
    );
}

#[tokio::test]
async fn moka_cache_store_extends_ttl_with_touch() {
    let store = MokaCacheStore::new("flowbase:test", 128);

    CacheStore::set_json(
        &store,
        "manifest:1",
        json!({ "parsed": true }),
        Some(Duration::milliseconds(40)),
    )
    .await
    .unwrap();
    tokio::time::sleep(std::time::Duration::from_millis(20)).await;

    assert!(
        CacheStore::touch(&store, "manifest:1", Duration::milliseconds(120))
            .await
            .unwrap()
    );
    tokio::time::sleep(std::time::Duration::from_millis(80)).await;

    assert_eq!(
        CacheStore::get_json(&store, "manifest:1").await.unwrap(),
        Some(json!({ "parsed": true }))
    );
}

#[tokio::test]
async fn moka_cache_store_supports_ephemeral_set_if_absent() {
    let store = MokaCacheStore::new("flowbase:test", 128);

    assert!(
        EphemeralKvStore::set_if_absent_json(&store, "lease", json!({ "owner": "a" }), None)
            .await
            .unwrap()
    );
    assert!(
        !EphemeralKvStore::set_if_absent_json(&store, "lease", json!({ "owner": "b" }), None)
            .await
            .unwrap()
    );
}
