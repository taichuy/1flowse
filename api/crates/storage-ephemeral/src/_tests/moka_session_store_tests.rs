use control_plane::ports::SessionStore;
use domain::SessionRecord;
use storage_ephemeral::MokaSessionStore;
use time::OffsetDateTime;
use uuid::Uuid;

fn fixture_session_with_expiry(expires_at_unix: i64) -> SessionRecord {
    SessionRecord {
        session_id: "session-1".to_string(),
        user_id: Uuid::now_v7(),
        tenant_id: Uuid::now_v7(),
        current_workspace_id: Uuid::now_v7(),
        session_version: 1,
        csrf_token: "csrf-1".to_string(),
        expires_at_unix,
    }
}

#[tokio::test]
async fn moka_session_store_put_get_touch_and_delete() {
    let store = MokaSessionStore::new("flowbase:session", 128);
    let now = OffsetDateTime::now_utc().unix_timestamp();
    let mut session = fixture_session_with_expiry(now + 60);

    store.put(session.clone()).await.unwrap();
    assert_eq!(store.get("session-1").await.unwrap(), Some(session.clone()));

    session.expires_at_unix += 60;
    store
        .touch("session-1", session.expires_at_unix)
        .await
        .unwrap();
    assert_eq!(
        store
            .get("session-1")
            .await
            .unwrap()
            .unwrap()
            .expires_at_unix,
        session.expires_at_unix
    );

    store.delete("session-1").await.unwrap();
    assert_eq!(store.get("session-1").await.unwrap(), None);
}

#[tokio::test]
async fn moka_session_store_drops_expired_session_on_get() {
    let store = MokaSessionStore::new("flowbase:session", 128);
    let expired = fixture_session_with_expiry(OffsetDateTime::now_utc().unix_timestamp() - 1);

    store.put(expired).await.unwrap();

    assert_eq!(store.get("session-1").await.unwrap(), None);
}

#[tokio::test]
async fn moka_session_store_touch_with_expired_deadline_deletes_session() {
    let store = MokaSessionStore::new("flowbase:session", 128);
    let now = OffsetDateTime::now_utc().unix_timestamp();
    let session = fixture_session_with_expiry(now + 60);

    store.put(session).await.unwrap();
    store.touch("session-1", now - 1).await.unwrap();

    assert_eq!(store.get("session-1").await.unwrap(), None);
}
