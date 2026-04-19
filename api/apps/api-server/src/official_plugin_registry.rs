use anyhow::{Context, Result};
use async_trait::async_trait;
use control_plane::ports::{
    DownloadedOfficialPluginPackage, OfficialPluginCatalogSnapshot, OfficialPluginCatalogSource,
    OfficialPluginSourceEntry, OfficialPluginSourcePort,
};
use plugin_framework::RuntimeTarget;
use reqwest::Client;
use serde::Deserialize;

use crate::config::ResolvedOfficialPluginSourceConfig;

#[derive(Clone)]
pub struct ApiOfficialPluginRegistry {
    source_kind: String,
    source_label: String,
    registry_url: String,
    trusted_public_keys: Vec<plugin_framework::TrustedPublicKey>,
    client: Client,
}

impl ApiOfficialPluginRegistry {
    pub fn new(
        source: ResolvedOfficialPluginSourceConfig,
        trusted_public_keys: Vec<plugin_framework::TrustedPublicKey>,
    ) -> Self {
        Self {
            source_kind: source.source_kind,
            source_label: source.source_label,
            registry_url: source.registry_url,
            trusted_public_keys,
            client: Client::new(),
        }
    }

    async fn fetch_registry(&self) -> Result<OfficialRegistryDocument> {
        self.client
            .get(&self.registry_url)
            .send()
            .await
            .context("failed to request official plugin registry")?
            .error_for_status()
            .context("official plugin registry returned an error status")?
            .json::<OfficialRegistryDocument>()
            .await
            .context("failed to decode official plugin registry")
    }

    async fn download_bytes(&self, url: &str) -> Result<Vec<u8>> {
        Ok(self
            .client
            .get(url)
            .send()
            .await
            .with_context(|| format!("failed to request official plugin package from {url}"))?
            .error_for_status()
            .with_context(|| format!("official plugin package request failed for {url}"))?
            .bytes()
            .await
            .context("failed to read official plugin package response body")?
            .to_vec())
    }
}

#[async_trait]
impl OfficialPluginSourcePort for ApiOfficialPluginRegistry {
    async fn list_official_catalog(&self) -> Result<OfficialPluginCatalogSnapshot> {
        let document = self.fetch_registry().await?;
        let host = RuntimeTarget::current_host().unwrap_or_else(|_| {
            RuntimeTarget::from_rust_target_triple("x86_64-unknown-linux-musl").unwrap()
        });
        Ok(OfficialPluginCatalogSnapshot {
            source: OfficialPluginCatalogSource {
                source_kind: self.source_kind.clone(),
                source_label: self.source_label.clone(),
                registry_url: self.registry_url.clone(),
            },
            entries: document
                .plugins
                .into_iter()
                .filter_map(|entry| {
                    let selected = select_artifact_for_host(&entry, &host)?;
                    Some(OfficialPluginSourceEntry {
                        release_tag: format!("{}-v{}", entry.provider_code, entry.latest_version),
                        plugin_id: entry.plugin_id,
                        provider_code: entry.provider_code,
                        display_name: entry.display_name,
                        protocol: entry.protocol,
                        latest_version: entry.latest_version,
                        download_url: selected.download_url,
                        checksum: selected.checksum,
                        trust_mode: default_trust_mode(),
                        signature_algorithm: selected.signature_algorithm,
                        signing_key_id: selected.signing_key_id,
                        help_url: entry.help_url,
                        model_discovery_mode: entry.model_discovery_mode,
                    })
                })
                .collect(),
        })
    }

    async fn download_plugin(
        &self,
        entry: &OfficialPluginSourceEntry,
    ) -> Result<DownloadedOfficialPluginPackage> {
        Ok(DownloadedOfficialPluginPackage {
            file_name: format!(
                "{}-{}.1flowbasepkg",
                entry.provider_code, entry.latest_version
            ),
            package_bytes: self.download_bytes(&entry.download_url).await?,
        })
    }

    fn trusted_public_keys(&self) -> Vec<plugin_framework::TrustedPublicKey> {
        self.trusted_public_keys.clone()
    }
}

#[derive(Debug, Deserialize)]
struct OfficialRegistryDocument {
    #[allow(dead_code)]
    version: u32,
    #[allow(dead_code)]
    generated_at: Option<String>,
    #[serde(default)]
    plugins: Vec<OfficialRegistryEntry>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct OfficialRegistryArtifact {
    pub os: String,
    pub arch: String,
    #[serde(default)]
    pub libc: Option<String>,
    pub rust_target: String,
    pub download_url: String,
    pub checksum: String,
    #[serde(default)]
    pub signature_algorithm: Option<String>,
    #[serde(default)]
    pub signing_key_id: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct OfficialRegistryEntry {
    pub plugin_id: String,
    pub provider_code: String,
    pub display_name: String,
    pub protocol: String,
    pub latest_version: String,
    pub help_url: Option<String>,
    pub model_discovery_mode: String,
    #[serde(default)]
    pub artifacts: Vec<OfficialRegistryArtifact>,
}

pub fn select_artifact_for_host(
    entry: &OfficialRegistryEntry,
    host: &RuntimeTarget,
) -> Option<OfficialRegistryArtifact> {
    entry
        .artifacts
        .iter()
        .cloned()
        .max_by_key(|artifact| {
            if artifact.os != host.os || artifact.arch != host.arch {
                return 0_u8;
            }

            match (host.libc.as_deref(), artifact.libc.as_deref()) {
                (Some(left), Some(right)) if left == right => 3,
                (Some("gnu"), Some("musl")) if host.os == "linux" => 2,
                (_, None) => 1,
                (None, Some(_)) => 1,
                _ => 0,
            }
        })
        .filter(|artifact| artifact.os == host.os && artifact.arch == host.arch)
}

fn default_trust_mode() -> String {
    "signature_required".to_string()
}
