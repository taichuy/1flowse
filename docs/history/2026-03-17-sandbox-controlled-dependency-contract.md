# 2026-03-17 Sandbox 受控依赖 contract 补齐

## 背景

- 近两轮 runtime 主线已经把 `sandbox_code` 和高风险 `tool/plugin` 的强隔离请求逐步收口到统一 `sandbox backend` contract，并明确要求强隔离路径 `fail-closed`。
- 但代码侧此前只真正校验了 `execution class / profile / networkPolicy / filesystemPolicy`，文档中已经定义的 `dependencyMode / builtinPackageSet / dependencyRef / backendExtensions` 还没有进入 host 侧约束。
- 这意味着“只开放受控 builtin package set、企业第三方依赖交给自定义 backend”的产品承诺还没有变成 runtime 可验证事实。

## 目标

- 把 sandbox 受控依赖约束从文档承诺推进到后端真实 contract。
- 让 `sandbox_code` 在声明 builtin package set / dependency ref 时能够被 host 侧验证，并在 backend capability 不满足时显式 `fail-closed`。
- 保持实现最小化，不引入第二套依赖管理 DSL，也不提前实现企业 backend 的镜像/挂载细节解释。

## 本轮实现

- 扩展 `api/app/services/sandbox_backends.py`：
  - `SandboxExecutionRequest` 新增 `dependency_mode`、`builtin_package_set`、`dependency_ref`、`backend_extensions`。
  - backend selection 新增 capability gating：只有 backend 显式声明支持对应 `dependencyMode` / builtin package set / backendExtensions 时才允许执行。
  - execute payload 会把这些字段透传给真实 sandbox backend。
- 扩展 `api/app/schemas/workflow_node_validation.py`：
  - 新增 `WorkflowNodeSandboxConfig`。
  - 增加约束：`builtinPackageSet` 只能配合 `dependencyMode = builtin`，`dependencyRef` 只能配合 `dependencyMode = dependency_ref`。
- 扩展 `api/app/services/runtime_execution_adapters.py`：
  - `RemoteSandboxExecutionAdapter` 读取并校验 `sandbox_code` 的依赖配置。
  - artifact/event 增加 `dependencyMode / builtinPackageSet / dependencyRef` 事实留痕，便于后续 trace / operator 排障。
- 补测试：
  - `api/tests/test_runtime_service.py` 覆盖受控 builtin package set 透传，以及 dependency mode 不被 backend 支持时的 fail-closed。
  - `api/tests/test_workflow_routes.py` 覆盖保存前 schema 级错误，避免错误依赖声明绕过 API 进入持久化链路。

## 影响评估

- **扩展性**：没有把企业依赖细节塞进 core，只增加最小 contract 字段，后续可继续由 backend/profile/admin 解释。
- **兼容性**：未破坏现有 `sandbox_code` 主链；未声明依赖字段的路径保持兼容。
- **可靠性 / 稳定性**：把“backend 没声明能力但仍继续运行”的灰色状态收紧为显式阻断，减少运行时漂移。
- **安全性**：把“受控 builtin package set / dependency ref”从文档约束推进成 host 侧 capability gate，更符合当前社区版安全边界。

## 验证

- `api/.venv/Scripts/uv.exe run pytest -q tests/test_runtime_service.py tests/test_workflow_routes.py`
- `api/.venv/Scripts/uv.exe run pytest -q`
- `git diff --check`

结果：后端全量测试 `328 passed`，`git diff --check` 仅报告 CRLF warning，无新增 diff error。

## 下一步

1. 把同一条 `dependencyMode / builtinPackageSet / backendExtensions` contract 继续扩到高风险 `tool/plugin` 的 execution payload 与 validation。
2. 在 system diagnostics / editor execution capability UI 中展示“为什么这个 backend 可用/不可用”，把依赖 capability 解释暴露给 operator。
3. 继续保持企业第三方依赖细节留在 backend/profile/admin 扩展，不在 workflow core 中新增更重的依赖 DSL。
