# 2026-03-17 plugin tool execution contract persistence

## 背景

- `docs/dev/runtime-foundation.md` 把 `P0` 继续收敛在 sandbox isolation / protocol 主链，重点是把高风险 tool/plugin 的 execution contract 从“文档承诺”推进到 runtime、authoring 和 operator 都能看到的事实。
- 上一轮提交 `ef58e8e` 已经把 native tool 的 `supported_execution_classes` 与 host-bound `sandboxBackend` 绑定进 dispatch 主链，但继续复核代码后发现还有一个更根本的断点：`plugin_tools` 持久化层并没有保存 tool-level execution contract，导致 adapter sync 后的 `supported_execution_classes` 在重启 / hydrate 后会漂移丢失。
- 同时，compat/native tool 在走默认执行策略时，`/invoke` payload 和 native invoker 仍可能收到空的 `execution`，使“默认走哪个 execution class”没有被真实透传到下游执行面。

## 目标

- 把 plugin tool 的 execution contract（至少包括 `supported_execution_classes` 与 `default_execution_class`）真正持久化到 `plugin_tools`，避免重启后 capability 漂移。
- 让 Tool Gateway、PluginCallProxy、workflow library、plugin registry API 和 adapter sync 消费同一份 tool execution 事实，而不是运行时、持久化和作者侧各看各的。
- 让 tool-level 默认执行类也能进入真实 dispatch / invoke payload，使“高风险 tool 默认强隔离”不再只是 catalog 元数据，而能推进到实际执行链路。

## 本轮实现

### 1. 为 plugin tool 持久化 execution contract

- 更新 `api/app/models/plugin.py`
- 更新 `api/app/services/plugin_registry_store.py`
- 新增迁移 `api/migrations/versions/20260317_0023_plugin_tool_execution_contracts.py`
- `plugin_tools` 现在新增：
  - `supported_execution_classes`
  - `default_execution_class`
- adapter sync、HTTP registration、workflow library hydrate 后都能保留同一份 tool execution contract，不会再因为进程重建丢回空值。

### 2. 统一 tool contract 的输入校验与 catalog 解析

- 更新 `api/app/services/plugin_runtime_types.py`
- 更新 `api/app/services/plugin_runtime_adapter_clients.py`
- 更新 `api/app/schemas/plugin.py`
- tool contract 现在会在进入 registry 前校验：
  - `default_execution_class` 必须属于合法 execution class
  - `default_execution_class` 必须包含在 `supported_execution_classes` 中
- compat adapter catalog 若返回无效 execution contract，现在会显式抛出 `PluginCatalogError`，而不是悄悄吞掉并把错误 contract 写进事实链。

### 3. 默认 execution 进入真实 dispatch / invoke 主链

- 更新 `api/app/services/plugin_execution_dispatch.py`
- 更新 `api/app/services/tool_gateway.py`
- dispatch planner 现在会优先识别 tool-level `default_execution_class`；当请求来源仍是 `default` 时，会用 tool contract 纠正生态级默认值。
- `effective_execution` payload 不再只在显式声明 execution 时才构造；即使走默认 execution，也会把 `class / source / sandboxBackend` 透传给 compat adapter 或 native invoker。
- Tool Gateway 在 DB 中存在 tool record 且策略来源仍为 `default` 时，会把 `source` 标成 `tool_default`，方便后续 operator / trace 区分“生态默认”与“工具默认”。

### 4. 同步 API / workflow library / 前端 contract

- 更新 `api/app/api/routes/plugins.py`
- 更新 `api/app/services/workflow_library.py`
- 更新 `web/lib/get-plugin-registry.ts`
- 更新 `web/lib/get-workflow-library.ts`
- `/api/plugins/tools`、workflow library snapshot 和前端 tool contract 现在都能拿到 `default_execution_class`，为后续把作者侧 preflight 扩展到“默认强隔离路径”打下统一事实基础。

## 影响评估

### 架构链条

- **扩展性增强**：tool-level execution contract 终于进入持久化层；后续为 native/compat tool 增加默认强隔离，不需要再靠内存注册时临时补丁。
- **兼容性增强**：adapter sync、registry hydrate、plugin API、workflow library 和 runtime dispatch 现在围绕同一份 tool contract 工作，减少“重启前后行为不同”的漂移。
- **可靠性 / 稳定性增强**：默认 execution 不再丢在 host 内部；下游 invoker/adapter 能收到一致的 execution payload，避免“trace 里说是强隔离，真正下游却不知道”的断层。
- **安全性增强**：高风险 tool 的默认 execution class 可以真正进入 dispatch 主链；当默认值指向 `sandbox / microvm` 时，backend selection 和 fail-closed 语义会照常生效。

### 对产品闭环的帮助

- 这轮主要推进的是 **AI 使用 + 人与 AI 协作 + AI 治理层** 共用的 runtime 主链，不是停留在纯结构打磨。
- **AI 使用**：Agent / tool node 即使没有显式写 execution，也能按 tool catalog 声明的默认隔离级别执行，而不是退回生态通用默认。
- **人与 AI 协作**：作者、operator 和 runtime 看到的是同一份 tool execution contract；sync 完的工具不会在重启后“看起来支持 microvm，实际又丢回空值”。
- **AI 治理层**：tool execution contract 已经形成可持久化、可暴露、可追踪的治理事实，为下一步按 `sensitivity_level` 收敛默认 execution、补 authoring preflight 提供基础。

## 验证

- 定向测试：`api/.venv/Scripts/uv.exe run pytest -q tests/test_plugin_runtime.py tests/test_plugin_routes.py tests/test_plugin_registry_store.py tests/test_workflow_library_routes.py`
  - 结果：`26 passed`
- 后端静态检查：`api/.venv/Scripts/uv.exe run ruff check ...`
  - 结果：通过
- 后端全量测试：`api/.venv/Scripts/uv.exe run pytest -q`
  - 结果：`335 passed in 46.09s`
- 前端类型检查：`web/pnpm exec tsc --noEmit`
  - 结果：通过
- 前端 lint：`web/pnpm lint`
  - 结果：通过（仅有 Next.js 自身关于 `next lint` 的弃用提示）
- diff 检查：`git diff --check`
  - 结果：无 diff error；当前仅有 LF/CRLF 提示

## 未完成与下一步

1. 当前已经把 tool execution contract 持久化并接到真实 dispatch，但还没有把 `sensitivity_level` 正式挂到 tool catalog contract，因此“高风险 tool 默认强隔离”仍主要依赖 `default_execution_class` 明示，而不是治理规则自动收敛。
2. 前后端 preflight 目前主要覆盖“显式 execution target”；下一步应继续补“默认 `sandbox / microvm` tool 在 backend readiness 不足时的保存前提示”，尤其是 tool node 和 `llm_agent.allowedToolIds` 场景。
3. compat adapter / native invoker 的“实际隔离兑现”仍在演进中；目前 host 已能把 contract 和 backend binding 透传下去，但 adapter/native 侧还需继续把这份 contract 真正落到执行后端。
