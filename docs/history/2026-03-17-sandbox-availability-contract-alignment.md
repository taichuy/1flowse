# 2026-03-17 Sandbox availability 与 execute contract 对齐

## 背景

- 前一轮已经把 `dependencyMode / builtinPackageSet / dependencyRef / backendExtensions` 接进 `sandbox_code` 的 schema、runtime execute payload 和 backend capability gate。
- 但 `RuntimeExecutionAdapterRegistry.describe_node_execution_availability()` 仍只按 `execution class / profile / networkPolicy / filesystemPolicy` 做 backend selection，没有复用 execute 侧同一份依赖/扩展约束。
- 这会留下一个真实风险：前置 availability 可能判断“backend 可用”，真正执行时才因为 dependency 或 `backendExtensions` capability 不满足而 fail-closed，导致调度前判断和运行时事实分叉。

## 目标

- 让 `sandbox_code` 的 availability、backend selection 与 execute 共用同一份 dispatch config。
- 把 dependency / `backendExtensions` 约束前移到调度前 capability gate，减少“先放行、后阻断”的不一致。
- 保持改动聚焦在 runtime 主链，不额外引入第二套 sandbox config 解释层。

## 本轮实现

- 在 `api/app/services/runtime_execution_adapters.py` 中新增共享的 `SandboxCodeDispatchConfig` 与解析 helper：
  - 统一解析 `language`、`code`、`dependencyMode`、`builtinPackageSet`、`dependencyRef`、`backendExtensions`。
  - 统一承接 `config.code` 必填、`builtinPackageSet` 只能配合 `builtin`、`dependencyRef` 只能配合 `dependency_ref`、`backendExtensions` 必须为 object 的约束。
- `RemoteSandboxExecutionAdapter.execute()` 改为直接复用这份共享 dispatch config，而不是本地再拼一套解析逻辑。
- `RuntimeExecutionAdapterRegistry.describe_node_execution_availability()` 现在会把 `dependency_mode / builtin_package_set / dependency_ref / backend_extensions` 一并传给 `SandboxExecutionRequest`，并在 config 本身非法时直接返回 blocked reason。
- 新增 runtime 测试，锁住两类场景：
  - availability request 会带上 `dependency_mode / dependency_ref`。
  - availability request 会带上 `backend_extensions`，并在 backend 不支持时 fail-close，而不是继续尝试执行。

## 影响评估

- **可靠性**：减少 execution planning 与 runtime execute 的语义分叉，避免 operator 看到“可执行”后又在真正运行时被延迟阻断。
- **稳定性**：shared helper 减少了 `sandbox_code` config 解析的重复逻辑，后续新增字段时不容易只改一半主链。
- **安全性**：把依赖与 backend 扩展约束继续前移到更早阶段，更符合强隔离路径 capability-driven fail-closed 的要求。
- **扩展性**：为下一步把相同 contract 扩到高风险 `tool/plugin` 提供了更清晰的共享边界。

## 验证

- `api/.venv/Scripts/uv.exe run ruff check api/app/services/runtime_execution_adapters.py api/tests/test_runtime_service.py`
- `api/.venv/Scripts/uv.exe run pytest -q tests/test_runtime_service.py`
- `api/.venv/Scripts/uv.exe run pytest -q`

结果：局部 runtime 测试 `25 passed`，后端全量测试 `329 passed`。

## 下一步

1. 把同一条 availability / execute contract 对齐思路继续扩到高风险 `tool/plugin` 的 execution payload 与 diagnostics explanation。
2. 继续推进 native tool 的统一 sandbox backend contract，而不是长期停留在 host-side fail-closed。
3. 在 diagnostics / system overview / editor preflight 中补更明确的 capability reason 展示，让 operator 和作者都能直接看到为什么某个 backend 不可用。
