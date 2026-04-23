#[derive(Debug, Clone, PartialEq, Eq)]
pub struct FileStorageHealthcheck {
    pub reachable: bool,
    pub detail: Option<String>,
}

pub struct FileStoragePutInput<'a> {
    pub config_json: &'a serde_json::Value,
    pub object_path: &'a str,
    pub content_type: Option<&'a str>,
    pub bytes: &'a [u8],
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct FileStoragePutResult {
    pub path: String,
    pub url: Option<String>,
    pub metadata_json: serde_json::Value,
}

pub struct DeleteObjectInput<'a> {
    pub config_json: &'a serde_json::Value,
    pub object_path: &'a str,
}

pub struct OpenReadInput<'a> {
    pub config_json: &'a serde_json::Value,
    pub object_path: &'a str,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct OpenReadResult {
    pub bytes: Vec<u8>,
    pub content_type: Option<String>,
}

pub struct GenerateAccessUrlInput<'a> {
    pub config_json: &'a serde_json::Value,
    pub object_path: &'a str,
}
