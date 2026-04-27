use std::{
    fs,
    path::PathBuf,
    time::{SystemTime, UNIX_EPOCH},
};

use plugin_framework::{provider_contract::ProviderStdioRequest, PluginRuntimeLimits};

fn write_script(name: &str, body: &str) -> PathBuf {
    let nonce = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_nanos();
    let root = std::env::temp_dir().join(format!("provider-stdio-v2-{name}-{nonce}"));
    fs::create_dir_all(&root).unwrap();
    let script = root.join("provider.sh");
    fs::write(&script, body).unwrap();

    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;

        let mut permissions = fs::metadata(&script).unwrap().permissions();
        permissions.set_mode(0o755);
        fs::set_permissions(&script, permissions).unwrap();
    }

    script
}

fn invoke_request() -> ProviderStdioRequest {
    ProviderStdioRequest {
        method: plugin_framework::provider_contract::ProviderStdioMethod::Invoke,
        input: serde_json::json!({ "model": "fixture" }),
    }
}

fn limits() -> PluginRuntimeLimits {
    PluginRuntimeLimits {
        timeout_ms: Some(2_000),
        memory_bytes: None,
    }
}

#[tokio::test]
async fn provider_stdio_v2_reads_ndjson_stream_until_result() {
    let script = write_script(
        "success",
        r#"#!/usr/bin/env bash
read _request
printf '%s\n' '{"type":"text_delta","delta":"hel"}'
printf '%s\n' '{"type":"text_delta","delta":"lo"}'
printf '%s\n' '{"type":"usage_snapshot","usage":{"input_tokens":2,"output_tokens":1,"total_tokens":3}}'
printf '%s\n' '{"type":"finish","reason":"stop"}'
printf '%s\n' '{"type":"result","result":{"final_content":"hello","usage":{"input_tokens":2,"output_tokens":1,"total_tokens":3},"finish_reason":"stop"}}'
"#,
    );

    let output = plugin_runner::stdio_runtime::call_executable_streaming(
        &script,
        &invoke_request(),
        &limits(),
    )
    .await
    .unwrap();

    assert_eq!(output.events.len(), 4);
    assert_eq!(output.result.final_content.as_deref(), Some("hello"));
}

#[tokio::test]
async fn provider_stdio_v2_rejects_bad_json_line() {
    let script = write_script(
        "bad-json",
        r#"#!/usr/bin/env bash
read _request
printf '%s\n' '{not-json'
"#,
    );

    let error = plugin_runner::stdio_runtime::call_executable_streaming(
        &script,
        &invoke_request(),
        &limits(),
    )
    .await
    .unwrap_err();

    assert!(error.to_string().contains("invalid provider ndjson"));
}
