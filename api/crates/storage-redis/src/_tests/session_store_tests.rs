use control_plane::ports::SessionStore;
use domain::SessionRecord;
use storage_redis::InMemorySessionStore;
use uuid::Uuid;

#[tokio::test]
async fn in_memory_session_store_round_trips_and_touches_sessions() {
    let store = InMemorySessionStore::default();
    let session = SessionRecord {
        session_id: "session-1".into(),
        user_id: Uuid::now_v7(),
        team_id: Uuid::now_v7(),
        session_version: 1,
        csrf_token: "csrf-1".into(),
        expires_at_unix: 100,
    };

    store.put(session.clone()).await.unwrap();
    assert_eq!(
        store.get("session-1").await.unwrap().unwrap().csrf_token,
        "csrf-1"
    );

    store.touch("session-1", 200).await.unwrap();
    assert_eq!(
        store
            .get("session-1")
            .await
            .unwrap()
            .unwrap()
            .expires_at_unix,
        200
    );

    store.delete("session-1").await.unwrap();
    assert!(store.get("session-1").await.unwrap().is_none());
}
