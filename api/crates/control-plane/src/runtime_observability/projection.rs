use sha2::{Digest, Sha256};

pub fn model_input_hash(input: &serde_json::Value) -> String {
    let bytes = serde_json::to_vec(input).unwrap_or_default();
    let digest = Sha256::digest(bytes);
    format!("sha256:{digest:x}")
}

pub fn estimate_tokens_for_text(text: &str) -> i64 {
    ((text.chars().count() as f64) / 4.0).ceil() as i64
}
