use std::{path::Path, process::Stdio, time::Duration};

use plugin_framework::{
    error::{FrameworkResult, PluginFrameworkError},
    provider_contract::{
        ProviderInvocationResult, ProviderRuntimeError, ProviderRuntimeErrorKind,
        ProviderRuntimeLine, ProviderStdioError, ProviderStdioRequest, ProviderStdioResponse,
        ProviderStreamEvent,
    },
    PluginRuntimeLimits,
};
use serde_json::Value;
use tokio::{
    io::{AsyncBufReadExt, AsyncReadExt, AsyncWriteExt, BufReader},
    process::Command,
};

#[derive(Debug, Clone, PartialEq)]
pub struct StreamingProviderOutput {
    pub events: Vec<ProviderStreamEvent>,
    pub result: ProviderInvocationResult,
}

pub async fn call_executable(
    executable_path: &Path,
    request: &ProviderStdioRequest,
    limits: &PluginRuntimeLimits,
) -> FrameworkResult<Value> {
    let mut command = Command::new(executable_path);
    command
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .kill_on_drop(true);
    apply_memory_limit(&mut command, limits.memory_bytes)?;

    let mut child = command
        .spawn()
        .map_err(|error| PluginFrameworkError::io(Some(executable_path), error.to_string()))?;

    if let Some(mut stdin) = child.stdin.take() {
        let payload = serde_json::to_vec(request)
            .map_err(|error| PluginFrameworkError::serialization(None, error.to_string()))?;
        stdin
            .write_all(&payload)
            .await
            .map_err(|error| PluginFrameworkError::io(Some(executable_path), error.to_string()))?;
    }

    let output = tokio::time::timeout(
        Duration::from_millis(limits.timeout_ms.unwrap_or(30_000)),
        child.wait_with_output(),
    )
    .await
    .map_err(|_| {
        PluginFrameworkError::runtime(ProviderRuntimeError::normalize(
            "invoke",
            "provider runtime timed out",
            None,
        ))
    })?
    .map_err(|error| PluginFrameworkError::io(Some(executable_path), error.to_string()))?;

    parse_stdio_response(executable_path, &output.stdout, &output.stderr)
}

pub async fn call_executable_streaming(
    executable_path: &Path,
    request: &ProviderStdioRequest,
    limits: &PluginRuntimeLimits,
    live_events: Option<tokio::sync::mpsc::UnboundedSender<ProviderStreamEvent>>,
) -> FrameworkResult<StreamingProviderOutput> {
    let mut command = Command::new(executable_path);
    command
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .kill_on_drop(true);
    apply_memory_limit(&mut command, limits.memory_bytes)?;

    let mut child = command
        .spawn()
        .map_err(|error| PluginFrameworkError::io(Some(executable_path), error.to_string()))?;

    if let Some(mut stdin) = child.stdin.take() {
        let mut payload = serde_json::to_vec(request)
            .map_err(|error| PluginFrameworkError::serialization(None, error.to_string()))?;
        payload.push(b'\n');
        stdin
            .write_all(&payload)
            .await
            .map_err(|error| PluginFrameworkError::io(Some(executable_path), error.to_string()))?;
    }

    let stdout = child.stdout.take().ok_or_else(|| {
        PluginFrameworkError::runtime(ProviderRuntimeError::normalize(
            "provider_runtime",
            "provider runtime stdout was not captured",
            None,
        ))
    })?;
    let stderr = child.stderr.take().ok_or_else(|| {
        PluginFrameworkError::runtime(ProviderRuntimeError::normalize(
            "provider_runtime",
            "provider runtime stderr was not captured",
            None,
        ))
    })?;

    let stderr_task = tokio::spawn(async move {
        let mut text = String::new();
        let _ = BufReader::new(stderr).read_to_string(&mut text).await;
        text
    });

    let timeout_ms = limits.timeout_ms.unwrap_or(30_000);
    tokio::time::timeout(Duration::from_millis(timeout_ms), async {
        let mut lines = BufReader::new(stdout).lines();
        let mut events = Vec::new();
        let mut result = None;

        while let Some(line) = lines
            .next_line()
            .await
            .map_err(|error| PluginFrameworkError::io(Some(executable_path), error.to_string()))?
        {
            let trimmed = line.trim();
            if trimmed.is_empty() {
                continue;
            }

            let runtime_line =
                serde_json::from_str::<ProviderRuntimeLine>(trimmed).map_err(|error| {
                    PluginFrameworkError::runtime(ProviderRuntimeError::normalize(
                        "invalid_provider_ndjson",
                        format!("invalid provider ndjson: {error}"),
                        Some(trimmed),
                    ))
                })?;
            match runtime_line {
                ProviderRuntimeLine::Result { result: value } => {
                    result = Some(value);
                }
                other => {
                    if let Some(event) = other.into_stream_event() {
                        if let Some(live_events) = &live_events {
                            let _ = live_events.send(event.clone());
                        }
                        events.push(event);
                    }
                }
            }
        }

        let status = child
            .wait()
            .await
            .map_err(|error| PluginFrameworkError::io(Some(executable_path), error.to_string()))?;
        let stderr = stderr_task.await.unwrap_or_default();
        if !status.success() {
            let summary = stderr.trim();
            return Err(PluginFrameworkError::runtime(
                ProviderRuntimeError::normalize(
                    "provider_runtime",
                    if summary.is_empty() {
                        "provider runtime exited with failure"
                    } else {
                        summary
                    },
                    None,
                ),
            ));
        }

        let result = result.ok_or_else(|| {
            PluginFrameworkError::runtime(ProviderRuntimeError::normalize(
                "provider_runtime",
                "provider runtime ended without result line",
                None,
            ))
        })?;

        Ok(StreamingProviderOutput { events, result })
    })
    .await
    .map_err(|_| {
        PluginFrameworkError::runtime(ProviderRuntimeError::normalize(
            "invoke",
            "provider runtime timed out",
            None,
        ))
    })?
}

fn parse_stdio_response(
    executable_path: &Path,
    stdout: &[u8],
    stderr: &[u8],
) -> FrameworkResult<Value> {
    let stdout = String::from_utf8_lossy(stdout).trim().to_string();
    let stderr = String::from_utf8_lossy(stderr).trim().to_string();
    if stdout.is_empty() {
        return Err(PluginFrameworkError::runtime(
            ProviderRuntimeError::normalize(
                "provider_runtime",
                if stderr.is_empty() {
                    "provider runtime returned empty output"
                } else {
                    stderr.as_str()
                },
                None,
            ),
        ));
    }

    let envelope = serde_json::from_str::<ProviderStdioResponse>(&stdout).map_err(|error| {
        PluginFrameworkError::serialization(Some(executable_path), error.to_string())
    })?;

    if envelope.ok {
        return Ok(envelope.result);
    }

    let error = envelope.error.unwrap_or_else(|| ProviderStdioError {
        kind: ProviderRuntimeErrorKind::ProviderInvalidResponse,
        message: if stderr.is_empty() {
            "provider runtime execution failed".to_string()
        } else {
            stderr.clone()
        },
        provider_summary: None,
    });
    Err(PluginFrameworkError::runtime(ProviderRuntimeError {
        kind: error.kind,
        message: error.message,
        provider_summary: error.provider_summary,
    }))
}

fn apply_memory_limit(command: &mut Command, memory_bytes: Option<u64>) -> FrameworkResult<()> {
    #[cfg(unix)]
    {
        if let Some(limit) = memory_bytes {
            unsafe {
                command.pre_exec(move || {
                    let limit = libc::rlimit {
                        rlim_cur: limit as libc::rlim_t,
                        rlim_max: limit as libc::rlim_t,
                    };
                    if libc::setrlimit(libc::RLIMIT_AS, &limit) != 0 {
                        return Err(std::io::Error::last_os_error());
                    }
                    Ok(())
                });
            }
        }
    }

    #[cfg(not(unix))]
    {
        let _ = (command, memory_bytes);
    }

    Ok(())
}
