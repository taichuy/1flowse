# 2026-03-17 sandbox backend registry and runtime bridge

## 背景

- `runtime-foundation` 一直把“独立 `SandboxBackendRegistration / SandboxExecution` 协议”列为 `P0`，但代码侧此前只有 `sandbox_code -> host subprocess` 的受控 MVP 路径。
- 现状虽然已经具备 execution-aware contract、fail-closed 语义和 execution diagnostics，但真正的 sandbox backend 仍停留在文档目标，容易让“协议边界清楚”与“真实隔离执行体落地”之间继续脱节。
- 用户本轮也明确强调更关注“沙箱隔离以及协议这个链路场景”。

## 目标

- 把 sandbox backend 从文档概念推进到独立代码层，不再复用 compat adapter 语义。
- 让 `sandbox_code` 除显式 `subprocess` MVP 外，也能在存在兼容且健康的 backend 时走独立 backend 执行链。
- 把 sandbox backend 的 readiness / health / capability 暴露到系统诊断面，方便 operator 和后续开发继续推进。

## 本轮实现

### 1. 新增独立 `sandbox_backends` 服务层

- 新增 `api/app/services/sandbox_backends.py`，定义：
  - `SandboxBackendCapability`
  - `SandboxBackendRegistration`
  - `SandboxBackendHealth`
  - `SandboxExecutionRequest / SandboxExecutionResponse`
  - `SandboxBackendRegistry`
  - `SandboxBackendHealthChecker`
  - `SandboxBackendClient`
- health 与 capability 走独立 `/healthz`、`/capabilities` 探测；执行走独立 `/execute`，避免与 compat plugin `/invoke` 混成一套对象模型。

### 2. 接入 runtime execution adapter 主链

- `api/app/services/runtime_execution_adapters.py` 新增 remote sandbox adapter：
  - `sandbox_code + execution.class = subprocess` 仍走现有 host subprocess MVP。
  - `sandbox_code + execution.class in {sandbox, microvm}` 现在会通过独立 sandbox backend client 选择 backend 并执行。
  - 若无兼容 backend、backend 离线、能力不匹配，继续 capability-driven `fail-closed`。
- `api/app/services/runtime.py` 支持注入 sandbox backend client，并在 runtime dependency refresh 后保持这条依赖不丢失。

### 3. 把 sandbox backend readiness 暴露到 system diagnostics

- `api/app/api/routes/system.py` 与 `api/app/schemas/system.py` 新增 sandbox backend 诊断输出。
- `GET /api/system/overview` 现在会返回 `sandbox_backends`，并把 sandbox backend 健康状态纳入 `services` 与 `capabilities`。
- 新增 `GET /api/system/sandbox-backends`，提供独立的 backend readiness 列表。
- `web/lib/get-system-overview.ts` 同步补齐对应类型，避免前端继续把 system overview 当成“只有 plugin adapter，没有 sandbox backend”的旧模型。

## 影响评估

### 对架构

- **扩展性增强**：sandbox backend 终于有独立注册/健康/能力/执行入口，后续接入多个 backend、更多 profile 或更强隔离形态时，不需要再把 compat adapter 语义拿来硬复用。
- **兼容性增强**：compat adapter 继续解决生态桥接，sandbox backend 继续解决隔离执行，两条外接能力边界更清楚。
- **可靠性与稳定性增强**：system overview 现能直接看见 sandbox backend readiness，减少“运行时 blocked 了才知道后端根本没起来”的滞后排障。
- **安全性增强**：强隔离路径不再只有“阻断说明”，而是已经具备最小真实 backend 接入点；没有兼容 backend 时仍保持 fail-closed。

### 对产品闭环

- 这轮不是停留在“细枝末节的重构”或“只修文案”。
- 它直接推进的是 **AI 与人协作层 + AI 治理层** 的主链底座：
  - operator 可以从 system diagnostics 明确看见 sandbox backend readiness；
  - runtime 可以沿独立协议执行强隔离代码节点，而不是继续只靠 host subprocess 充当未来正式路径；
  - 后续高风险 tool/plugin 继续收口到同一条 protocol 时，不需要重起一套 registry/model。

## 验证

- 后端针对改动相关测试：`api/.venv/Scripts/uv.exe run pytest -q tests/test_runtime_service.py tests/test_system_routes.py`
  - 结果：`27 passed`
- 后端全量测试：`api/.venv/Scripts/uv.exe run pytest -q`
  - 结果：`321 passed`
- 前端类型检查：`web/pnpm exec tsc --noEmit`
  - 结果：通过
- 前端 lint：`web/pnpm lint`
  - 结果：通过

## 仍未完成的缺口

- 当前真实 backend 执行先落在 `sandbox_code`，尚未扩到高风险 `tool/plugin`。
- profile / dependency mode 现在已有 capability 入口，但还没有完整的 workflow-level / admin-level 治理面。
- system overview 已能看 readiness，但更细的 operator 解释与恢复动作仍主要集中在 run / inbox / diagnostics 主链。

## 下一步

1. 把高风险 `tool/plugin` 接到同一条 sandbox backend contract，而不是继续停留在代码节点单点打通。
2. 为 sandbox backend 补更明确的 profile / dependency governance 边界，避免企业环境细节直接回流到核心 IR。
3. 继续把 system-level readiness 与 run-level execution diagnostics 串成更一致的 operator 排障入口。
