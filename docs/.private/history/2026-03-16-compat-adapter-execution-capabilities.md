# 2026-03-16 compat adapter execution capability guard 与现状判断

## 背景

本轮先按仓库协作约定复核了以下事实来源：

- `AGENTS.md`
- `docs/dev/user-preferences.md`
- `docs/product-design.md`
- `docs/open-source-commercial-strategy.md`
- `docs/technical-design-supplement.md`
- `docs/dev/runtime-foundation.md`
- 当前仓库结构、长文件热点与最近一次 Git 提交 `45a675e feat: forward execution contract to compat adapters`

复核结论：

- 项目已经不是“只有框架”的状态；`api/` 的 runtime / publish / trace / sensitive access 主链，以及 `web/` 的 workflow editor / run diagnostics / publish / inbox 基础都已落到真实代码路径。
- 当前还没到“只剩人工逐项界面设计”的阶段，因此本轮不触发通知脚本 `node "e:\code\taichuCode\ai-presson-wen\aionui\notice\kill-port-8050.js"`。
- 最近一次提交把 compat adapter `/invoke` 请求补上了 `execution` payload forwarding，但还缺少“adapter 到底声明支持哪些 execution class”的显式能力边界，导致 host 侧 trace 仍只能把 compat tool 一概当作 `subprocess` bridge，而请求体又可能把 `microvm / sandbox` 原样透传给一个并未声明支持的 adapter。

## 项目现状判断

### 1. 上一次 Git 提交做了什么，是否需要衔接

需要衔接，而且这次衔接属于同一条 execution 主线的继续收口。

- `45a675e feat: forward execution contract to compat adapters` 主要做了：
  - 给 compat adapter `/invoke` 请求补上统一 `execution` payload。
  - 用测试证明 `llm_agent` / tool call 的 execution override 可以走到 compat adapter 边界。
- 但它还没回答一个更基础的问题：**adapter 自己是否真的声明支持被请求的 execution class**。
- 如果不把这层能力显式建模，runtime trace、artifact 元数据和 adapter 请求体之间会继续存在“事实不够一致”的风险。

### 2. 基础框架是否已经写好

结论：**已经足够支撑持续功能开发，不需要再把精力花在重写底座。**

- `RuntimeService` 仍保持唯一主控，没有被 compat adapter、publish gateway 或 assistant pipeline 反客为主。
- `runs / node_runs / run_events / run_artifacts / tool_call_records / ai_call_records` 已是稳定事实层。
- workflow editor、published surface、workspace starters、sensitive access inbox 都已接上真实后端，不是空页面。

### 3. 架构是否满足功能推进、扩展性、兼容性、可靠性、安全性

当前判断：**满足继续做主业务，但仍有 P0/P1 缺口需要边做边收。**

- 功能性开发：满足度较高，主干链路可持续推进。
- 插件扩展性：方向正确；native tool、compat adapter、tool catalog 已分层，但 compat lifecycle / store hydration / execution capability 还需要继续细化。
- 兼容性：当前边界仍健康；只兼容 Dify 插件生态，没有让外部 DSL 反向主导 `7Flows IR`。
- 可靠性与稳定性：运行追溯、waiting/resume、approval timeline、notification worker 已成链，但 callback/operator 聚合面仍要继续补强。
- 安全性：敏感访问控制闭环已经进入真实主链；execution 隔离语义也开始落到 tool/adapter 边界，但真实 `sandbox / microvm` 执行体还没完全到位。

### 4. 当前仍值得优先关注的长文件热点

- `api/app/services/runtime_node_dispatch_support.py`
- `api/app/services/agent_runtime_llm_support.py`
- `api/app/services/workspace_starter_templates.py`
- `api/app/services/run_views.py`
- `web/components/workflow-editor-workbench/use-workflow-editor-graph.ts`

这些文件已经进入“再继续堆主链功能会明显变脆”的区间，但还没有严重到必须先停工大拆；当前更合适的策略仍是**围绕主业务链按热点渐进拆层**。

## 本轮目标

把上一轮 execution forwarding 继续补成“host 侧可声明、可校准、可追溯”的能力边界：

1. 为 compat adapter 显式建模 `supported_execution_classes`。
2. 让 `ToolGateway -> PluginCallProxy -> compat adapter` 在请求体、trace、artifact 三处保持一致的 effective execution 语义。
3. 避免未声明支持的 adapter 被动收到 `sandbox / microvm` 请求，改成 host 侧先显式降级。

## 本轮实现

### 1. adapter execution capability 进入正式事实层

- `PluginAdapterRegistration` 新增 `supported_execution_classes`，默认 `("subprocess",)`。
- `plugin_adapters` 表新增 `supported_execution_classes` JSON 列，并补 Alembic 迁移 `api/migrations/versions/20260316_0022_plugin_adapter_execution_capabilities.py`。
- `/api/plugins/adapters` 的 create/list schema 与 route 序列化同步补上该字段。

### 2. compat tool dispatch 改成“声明能力 + 诚实降级”

- `PluginCallProxy.describe_execution_dispatch()` 会根据 adapter 的 `supported_execution_classes` 计算 requested/effective execution class。
- 如果 adapter 未声明支持请求的 class，host 侧会把 `/invoke` 的 `execution.class` 显式降级到 adapter 当前声明的默认 class，而不是继续被动透传。
- 这时 runtime trace / artifact 元数据会继续保留 requested/effective/fallback 事实，fallback reason 统一为 `compat_adapter_execution_class_not_supported`。

### 3. ToolGateway trace 与实际请求体重新对齐

- `ToolGateway.execute()` 现在先构造 `PluginCallRequest`，再复用 `PluginCallProxy.describe_execution_dispatch()` 生成 trace payload。
- 这样 `tool.execution.dispatched` / `tool.execution.fallback` / tool result artifact metadata 与真实 `/invoke` payload 使用同一套 planning 逻辑，不再各自猜一份。

### 4. 补齐回归测试

- `api/tests/test_plugin_runtime.py`
  - 保留 compat adapter forwarding 行为验证。
  - 新增“adapter 只声明 `subprocess` 时，`microvm` 请求会被 host 侧显式降级”的单测。
- `api/tests/test_plugin_routes.py`
  - 补 adapter registration API 对 `supported_execution_classes` 的序列化覆盖。
- `api/tests/test_plugin_registry_store.py`
  - 补 store hydrate/upsert 对 execution capability 的持久化回归。
- `api/tests/test_runtime_service_agent_runtime.py`
  - 调整 compat agent runtime 端到端用例，验证 fallback trace 与真实 `/invoke` payload 现在一致指向 `subprocess`。

## 验证

在 `api/` 目录执行：

```powershell
.\.venv\Scripts\uv.exe run pytest tests/test_plugin_runtime.py tests/test_plugin_routes.py tests/test_plugin_registry_store.py tests/test_runtime_service_agent_runtime.py -q
.\.venv\Scripts\uv.exe run ruff check app/services/plugin_runtime_types.py app/services/plugin_runtime_proxy.py app/services/tool_gateway.py app/services/plugin_runtime_registry.py app/services/plugin_registry_store.py app/models/plugin.py app/schemas/plugin.py app/api/routes/plugins.py tests/test_plugin_runtime.py tests/test_plugin_routes.py tests/test_plugin_registry_store.py tests/test_runtime_service_agent_runtime.py
.\.venv\Scripts\uv.exe run pytest -q
```

结果：

- 局部回归：`29 passed`
- `ruff check`：通过
- 后端全量测试：`282 passed`

## 当前结论

- 基础框架已经足够支撑继续推进产品设计中的核心功能，不需要回退到“先把框架重写一遍”的阶段。
- 当前架构整体上满足功能开发、插件扩展、兼容演进和稳定追溯，但 `graded execution -> 真实隔离执行体` 仍然是最重要的 P0 缺口。
- 本轮把 compat adapter execution 从“只是转发 payload”推进到了“有能力声明、有 host-side guard、有一致 trace”的状态，更符合产品设计里对可靠性、安全性和可追溯性的要求。

## 下一步建议

1. **P0：让声明支持 `sandbox / microvm` 的 compat adapter 真正兑现隔离执行**
   - 当前 host 侧已经能区分“声明支持”和“未声明支持”，下一步应补 adapter 侧的真实执行实现，而不是长期停留在 payload/trace 层。
2. **P0：继续补真实 tool execution adapter**
   - 当前 `sandbox_code` 只有 host-subprocess MVP，tool path 仍缺少真正的 `sandbox / microvm` 执行体。
3. **P1：继续拆解 runtime 热点文件**
   - 优先 `runtime_node_dispatch_support.py`、`agent_runtime_llm_support.py`、`run_views.py`，避免高频主链继续膨胀。
