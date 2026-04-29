use async_trait::async_trait;
use control_plane::ports::SessionStore;
use domain::SessionRecord;

use crate::{
    session_store::{is_session_expired, session_ttl},
    EphemeralKvStore, MokaCacheStore,
};

#[derive(Clone)]
pub struct MokaSessionStore {
    kv: MokaCacheStore,
}

impl MokaSessionStore {
    pub fn new(namespace: impl Into<String>, max_capacity: u64) -> Self {
        Self {
            kv: MokaCacheStore::new(namespace, max_capacity),
        }
    }

    async fn read_session(&self, session_id: &str) -> anyhow::Result<Option<SessionRecord>> {
        self.kv
            .get_json(session_id)
            .await?
            .map(serde_json::from_value::<SessionRecord>)
            .transpose()
            .map_err(Into::into)
    }
}

#[async_trait]
impl SessionStore for MokaSessionStore {
    async fn put(&self, session: SessionRecord) -> anyhow::Result<()> {
        self.kv
            .set_json(
                &session.session_id,
                serde_json::to_value(&session)?,
                Some(session_ttl(session.expires_at_unix)),
            )
            .await
    }

    async fn get(&self, session_id: &str) -> anyhow::Result<Option<SessionRecord>> {
        let Some(session) = self.read_session(session_id).await? else {
            return Ok(None);
        };

        if is_session_expired(&session) {
            self.delete(session_id).await?;
            return Ok(None);
        }

        Ok(Some(session))
    }

    async fn delete(&self, session_id: &str) -> anyhow::Result<()> {
        self.kv.delete(session_id).await
    }

    async fn touch(&self, session_id: &str, expires_at_unix: i64) -> anyhow::Result<()> {
        let ttl = session_ttl(expires_at_unix);
        if ttl <= time::Duration::ZERO {
            self.delete(session_id).await?;
            return Ok(());
        }

        let Some(mut session) = self.read_session(session_id).await? else {
            return Ok(());
        };
        if is_session_expired(&session) {
            self.delete(session_id).await?;
            return Ok(());
        }

        session.expires_at_unix = expires_at_unix;
        self.kv
            .set_json(session_id, serde_json::to_value(&session)?, Some(ttl))
            .await
    }
}
