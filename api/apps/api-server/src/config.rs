use anyhow::{anyhow, Result};
use std::collections::BTreeMap;

#[derive(Debug, Clone)]
pub struct ApiConfig {
    pub database_url: String,
    pub redis_url: String,
    pub cookie_name: String,
    pub session_ttl_days: i64,
    pub bootstrap_team_name: String,
    pub bootstrap_root_account: String,
    pub bootstrap_root_email: String,
    pub bootstrap_root_password: String,
    pub bootstrap_root_name: String,
    pub bootstrap_root_nickname: String,
}

impl ApiConfig {
    pub fn from_env() -> Result<Self> {
        let vars = std::env::vars().collect::<Vec<_>>();
        let refs = vars
            .iter()
            .map(|(key, value)| (key.as_str(), value.as_str()))
            .collect::<Vec<_>>();

        Self::from_env_map(&refs)
    }

    pub fn from_env_map(entries: &[(&str, &str)]) -> Result<Self> {
        let map = entries
            .iter()
            .map(|(key, value)| ((*key).to_string(), (*value).to_string()))
            .collect::<BTreeMap<_, _>>();

        let get = |key: &str| -> Result<String> {
            map.get(key)
                .cloned()
                .ok_or_else(|| anyhow!("missing env {key}"))
        };

        Ok(Self {
            database_url: get("API_DATABASE_URL")?,
            redis_url: get("API_REDIS_URL")?,
            cookie_name: map
                .get("API_COOKIE_NAME")
                .cloned()
                .unwrap_or_else(|| "flowse_console_session".to_string()),
            session_ttl_days: map
                .get("API_SESSION_TTL_DAYS")
                .and_then(|value| value.parse::<i64>().ok())
                .unwrap_or(7),
            bootstrap_team_name: get("BOOTSTRAP_TEAM_NAME")?,
            bootstrap_root_account: get("BOOTSTRAP_ROOT_ACCOUNT")?,
            bootstrap_root_email: get("BOOTSTRAP_ROOT_EMAIL")?,
            bootstrap_root_password: get("BOOTSTRAP_ROOT_PASSWORD")?,
            bootstrap_root_name: map
                .get("BOOTSTRAP_ROOT_NAME")
                .cloned()
                .unwrap_or_else(|| "Root".to_string()),
            bootstrap_root_nickname: map
                .get("BOOTSTRAP_ROOT_NICKNAME")
                .cloned()
                .unwrap_or_else(|| "Root".to_string()),
        })
    }
}
