# 2026-03-16 已验证的项目现状复核（补充最近提交与代码热点）

## 背景

- 在已有 `docs/history/2026-03-16-project-status-review-and-architecture-assessment.md` 的基础上，再次按用户要求复核 `AGENTS.md`、用户偏好、产品/技术/策略基线、`runtime-foundation`、最近提交和实际代码结构。
- 本轮重点补充两类信息：一是把“最近提交是否需要衔接”的结论与当前 `HEAD` 对齐；二是用真实验证和代码体量抽样，再次确认项目是否已经具备持续功能开发的基础。

## 本轮复核输入

- 规则与偏好：`AGENTS.md`、`docs/dev/user-preferences.md`
- 设计基线：`docs/product-design.md`、`docs/technical-design-supplement.md`、`docs/open-source-commercial-strategy.md`
- 当前事实：`docs/dev/runtime-foundation.md`
- 最近提交：
  - `159b712 docs: record architecture assessment and priorities`
  - `5fe1652 docs: record status review after workspace starter split`
  - `94ad5ed refactor: split workspace starter library state`
- 代码抽样：`api/app/services/runtime.py`、`api/app/services/agent_runtime.py`、`api/app/services/tool_gateway.py`、`api/app/api/routes/workflows.py`、`web/app/page.tsx`、`web/components/workflow-editor-workbench.tsx`

## 最近提交与衔接判断

### 1. 最近一次提交做了什么

- 当前 `HEAD` 是 `159b712 docs: record architecture assessment and priorities`。
- 该提交属于文档留痕更新，继续把项目现状、架构评估和优先级判断沉淀进仓库事实层。
- 它没有改变 runtime 语义、插件边界、发布协议或安全模型，因此不构成新的架构拐点。

### 2. 是否需要衔接

- 需要继续衔接，但衔接点仍然是最近一次正式代码提交 `94ad5ed refactor: split workspace starter library state`。
- 最近三次提交的关系很清晰：先做代码热点拆分，再做状态复核文档，再做架构与优先级留痕；这是一条连续的“拆热点 -> 校准事实 -> 明确优先级”的主线，而不是新的方向切换。

## 代码与架构抽样结论

### 1. 基础框架是否已经写好

- 结论：已经写到足以继续推进功能开发的程度，不需要回头重搭主骨架。
- `api/app/services/runtime.py` 目前保持 executor facade + mixin orchestration 结构，说明 runtime 主控仍然是单一事实源，没有被 publish、plugin 或 sandbox 分叉出第二套流程控制语义。
- `api/app/services/agent_runtime.py` 与 `api/app/services/tool_gateway.py` 已把 AI 执行与工具调用分层到独立服务，且 sensitive access 检查走统一治理入口，方向与设计基线一致。
- `api/app/api/routes/workflows.py` 仍保持薄路由 + service 校验 + schema 输出，说明 workflow persistence 与 validation 没有重新回流到路由层。
- `web/components/workflow-editor-workbench.tsx` 已退到工作台装配层，大量状态与保存逻辑已分流到 hooks，这说明前端主骨架也已经具备持续演进条件。

### 2. 插件扩展性、兼容性、可靠性与安全性

- `7Flows IR` 仍然是中心模型，compat adapter 仍在边缘映射，没有看到被 Dify/OpenAI/Anthropic 协议反向主导内部事实模型的迹象。
- runtime、agent、tool gateway、sensitive access、published surface 之间虽然还在持续拆层，但依赖方向整体清晰，已经满足继续补闭环的工程条件。
- 当前风险主要来自热点模块体量偏大和 waiting/callback/governance 解释链路仍需继续收口，而不是架构方向错误。

## 代码热点抽样

### 1. 后端热点

- `api/app/services/workspace_starter_templates.py`：575 行
- `api/app/services/runtime_node_dispatch_support.py`：573 行
- `api/app/services/agent_runtime.py`：523 行
- `api/app/services/workflow_library_catalog.py`：484 行
- `api/app/services/runtime_run_support.py`：450 行
- `api/app/services/sensitive_access_control.py`：426 行
- `api/app/services/notification_delivery.py`：420 行
- `api/app/services/run_callback_ticket_cleanup.py`：415 行
- `api/app/services/run_trace_views.py`：405 行

### 2. 前端热点

- `web/lib/get-workflow-publish.ts`：457 行
- `web/lib/workflow-tool-execution-validation.ts`：399 行
- `web/components/workflow-editor-variable-form.tsx`：376 行
- `web/components/workspace-starter-library/use-workspace-starter-library-state.ts`：364 行
- `web/app/page.tsx`：340 行
- `web/components/sensitive-access-inbox-panel.tsx`：337 行
- `web/components/workflow-node-config-form/tool-node-config-form.tsx`：336 行
- `web/components/workflow-node-config-form/runtime-policy-form.tsx`：304 行

### 3. 判断

- 这些文件并不意味着“已经失控”，但都处于下一轮最适合继续解耦的区间。
- 后续应优先继续拆解同时承接 orchestration、validation、hydration、bulk governance 和 provider-specific 分支的文件，而不是按行数机械拆分。

## 验证

- `cd api; .\.venv\Scripts\uv.exe run pytest -q`
  - `300 passed in 33.13s`
- `cd web; pnpm exec tsc --noEmit`
  - 通过

## 结论

- 当前项目已经具备继续推进主业务闭环的基础，不需要回头重搭基础框架。
- 现在最该做的是继续沿既有主线，优先打通 waiting / resume / callback、sensitive access governance explanation、publish diagnostics 三条高价值闭环，同时持续拆解 backend service 与 frontend state/validation 热点。
- 当前仍未达到“只剩人工逐项界面设计”的阶段，因此本轮不触发通知脚本。
