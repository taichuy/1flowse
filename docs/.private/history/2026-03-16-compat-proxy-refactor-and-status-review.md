# 2026-03-16 compat proxy 解耦与项目现状复核

## 背景

本轮先按仓库协作约定复核了以下事实来源：

- `AGENTS.md`
- `docs/dev/user-preferences.md`
- `docs/product-design.md`
- `docs/open-source-commercial-strategy.md`
- `docs/technical-design-supplement.md`
- `docs/dev/runtime-foundation.md`
- 最近一次 Git 提交 `6c1f4c3 feat: declare compat adapter execution capabilities`
- 当前仓库结构、后端 / 前端长文件热点与主链测试基线

用户本轮的核心诉求包括：

- 了解当前项目是否仍停留在“基础框架阶段”
- 复核最近一次提交做了什么、是否需要衔接
- 判断当前架构是否支持后续功能推进、插件扩展、兼容性、可靠性、稳定性与安全性
- 判断部分长文件是否已经进入需要解耦的区间
- 在优先级明确的前提下继续推进一项实际开发，并同步文档留痕

## 现状判断

### 1. 最近一次 Git 提交做了什么，是否需要衔接

需要衔接，而且应继续沿同一条 compat execution 主线推进。

- `6c1f4c3 feat: declare compat adapter execution capabilities` 已把 compat adapter 的 `supported_execution_classes` 纳入正式事实层。
- 这使 `ToolGateway -> PluginCallProxy -> compat adapter` 的 requested/effective execution 语义变得一致，也让 host-side honest fallback 成为已落地能力。
- 但落地后，`plugin_runtime_proxy.py` 同时承担了 execution planning、constrained-ir contract 绑定、HTTP transport 三种职责，继续在这个单文件上叠功能会放大后续 lifecycle / store hydration / 真实 sandbox/microvm 执行兑现的改动成本。

### 2. 基础框架是否已经写好

结论：**已经足够支撑持续功能开发，不需要回退到重写底座。**

- `RuntimeService` 仍保持单一主控，没有被 compat adapter、发布协议或 assistant 辅助认知链反客为主。
- `runs / node_runs / run_events / run_artifacts / tool_call_records / ai_call_records` 已构成稳定事实层。
- workflow editor、published surface、workspace starters、sensitive access inbox 都已接上真实后端，不是只有页面壳。
- 当前还没到“只剩人工逐项界面设计 / 人工验收”的阶段，因此本轮不触发通知脚本 `node "e:\code\taichuCode\ai-presson-wen\aionui\notice\kill-port-8050.js"`。

### 3. 架构是否支持后续功能、扩展性与稳定性目标

当前判断：**支持继续推进主业务，但仍需边做边收口高频热点。**

- 功能性开发：主链已经足够完整，可以继续围绕产品设计中的编排、调试、发布、追溯和治理能力推进。
- 插件扩展性：native tool、compat adapter、tool catalog、execution policy 已分层；但 compat lifecycle / catalog / store hydration 仍是下一轮应优先继续治理的边界。
- 兼容性：当前仍坚持“只兼容 Dify 插件生态，不兼容 Dify 全量 DSL / UI / 平台结构”，没有让外部协议反向主导 `7Flows IR`。
- 可靠性 / 稳定性：waiting / resume、callback、approval timeline、notification worker、trace/export 主链都已成形；但 callback/operator 聚合解释与更多自动投递 adapter 仍需继续补齐。
- 安全性：敏感访问闭环与 execution capability guard 都已进入真实执行链，但真实 `sandbox / microvm` 执行体仍是比“payload/trace 对齐”更高优先级的下一步。

### 4. 当前仍值得优先继续治理的热点

- `api/app/services/runtime_node_dispatch_support.py`
- `api/app/services/agent_runtime_llm_support.py`
- `api/app/services/workspace_starter_templates.py`
- `api/app/services/run_views.py`
- `web/components/workflow-editor-workbench/use-workflow-editor-graph.ts`

这些文件仍处于“可继续推进功能，但不宜继续无边界膨胀”的区间。

## 本轮决策

本轮选择继续衔接 compat execution 主线，但优先解决**结构性阻塞点**而不是再堆一层功能：

1. 把 compat adapter 的 execution planning 从 `plugin_runtime_proxy.py` 中拆出。
2. 把 constrained-ir execution contract 构建与 request 绑定校验也从同一文件拆出。
3. 保持 `ToolGateway` trace、host-side capability guard 与 compat adapter `/invoke` payload 继续复用同一套 execution planning 语义。

原因：

- 这是当前最贴近最近一轮提交、又足够低风险的高优先级收口点。
- 它直接回应了“部分代码文件是否太长需要解耦”的问题。
- 它为后续补真实 `sandbox / microvm` tool adapter、compat adapter lifecycle / store hydration 提前腾出了更稳定的 service 边界。

## 本轮实现

### 1. compat proxy 从多职责文件拆成三层

- `api/app/services/plugin_runtime_proxy.py`
  - 从约 459 行收口到约 157 行。
  - 现在主要只保留 native / compat transport dispatch 与 `/invoke` HTTP 交互。
- `api/app/services/plugin_execution_dispatch.py`
  - 新增 execution planning helper，统一计算 requested/effective execution、executor_ref、fallback_reason 与 effective execution payload。
- `api/app/services/plugin_execution_contract.py`
  - 新增 constrained-ir execution contract 构建与 contract-bound request 校验 helper。

### 2. 保持 execution 主链语义不变但边界更清晰

- `PluginCallProxy.describe_execution_dispatch()` 改为委托给 `PluginExecutionDispatchPlanner`。
- `_invoke_adapter_tool()` 在已经拿到 resolved adapter 的前提下，直接复用同一 planner，避免在 compat invoke path 上重复解析 adapter。
- `ToolGateway` 继续沿用同一个 `PluginCallProxy.describe_execution_dispatch()` 入口，因此 trace、artifact metadata 与实际 `/invoke` payload 仍然保持一致事实。

## 影响范围

- 后端 compat plugin transport 的结构可维护性明显提升。
- execution policy、adapter capability guard 与 constrained-ir contract 绑定从“proxy 内联实现”变成“可独立演进的 helper 边界”。
- 本轮没有改变外部 API contract，也没有改动运行时事实模型。

## 验证

在 `api/` 目录执行：

```powershell
.\.venv\Scripts\uv.exe run pytest tests/test_plugin_runtime.py tests/test_plugin_routes.py tests/test_plugin_registry_store.py tests/test_runtime_service_agent_runtime.py -q
.\.venv\Scripts\uv.exe run ruff check app/services/plugin_runtime_proxy.py app/services/plugin_execution_dispatch.py app/services/plugin_execution_contract.py app/services/tool_gateway.py tests/test_plugin_runtime.py tests/test_plugin_routes.py tests/test_plugin_registry_store.py tests/test_runtime_service_agent_runtime.py
.\.venv\Scripts\uv.exe run pytest -q
```

结果：

- 局部回归：`29 passed`
- `ruff check`：通过
- 后端全量测试：`282 passed`

## 结论

- 项目当前已经不是“基础框架尚未设计完”的状态，而是可以继续沿产品设计要求持续补完主业务能力的阶段。
- 当前架构整体满足继续做功能、插件兼容和稳定性建设，但必须持续治理高频热点文件，避免主链 service 再次回涨成 God object。
- 本轮选择的 compat proxy 解耦属于“优先级正确、风险较低、能为后续主功能开发让路”的工程性收口。

## 下一步建议

1. **P0：继续把 execution capability 兑现成真实隔离执行体**
   - 补真实 `sandbox / microvm` tool adapter，以及 compat adapter 对已声明 execution class 的实际隔离兑现，不要长期停留在 payload/trace/guard 层。
2. **P1：继续治理 compat plugin lifecycle / catalog / store hydration**
   - 在现有 `plugin_execution_dispatch.py` / `plugin_execution_contract.py` 边界上继续拆 adapter 生命周期、catalog 同步与 workspace-scoped hydration。
3. **P1：继续拆 backend / frontend 主热点**
   - 后端优先 `runtime_node_dispatch_support.py`、`agent_runtime_llm_support.py`、`run_views.py`；前端优先 `use-workflow-editor-graph.ts`。
