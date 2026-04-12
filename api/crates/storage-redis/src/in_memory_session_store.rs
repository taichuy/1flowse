use anyhow::Result;
use async_trait::async_trait;
use control_plane::ports::SessionStore;
use domain::SessionRecord;
use std::{collections::HashMap, sync::Arc};
use tokio::sync::RwLock;

#[derive(Default, Clone)]
pub struct InMemorySessionStore {
    inner: Arc<RwLock<HashMap<String, SessionRecord>>>,
}

#[async_trait]
impl SessionStore for InMemorySessionStore {
    async fn put(&self, session: SessionRecord) -> Result<()> {
        self.inner
            .write()
            .await
            .insert(session.session_id.clone(), session);
        Ok(())
    }

    async fn get(&self, session_id: &str) -> Result<Option<SessionRecord>> {
        Ok(self.inner.read().await.get(session_id).cloned())
    }

    async fn delete(&self, session_id: &str) -> Result<()> {
        self.inner.write().await.remove(session_id);
        Ok(())
    }

    async fn touch(&self, session_id: &str, expires_at_unix: i64) -> Result<()> {
        if let Some(existing) = self.inner.write().await.get_mut(session_id) {
            existing.expires_at_unix = expires_at_unix;
        }
        Ok(())
    }
}
