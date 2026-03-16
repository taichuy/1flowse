# 2026-03-16 架构成熟度复核补充

## 背景

- 用户要求重新阅读仓库协作规则、用户偏好、产品/技术/开源策略文档，并结合当前实现判断：基础框架是否已经写好、是否足以支撑持续功能开发、插件扩展与兼容演进、可靠性/稳定性/安全治理，以及哪些代码热点仍需继续解耦。
- 本轮目标不是重新设计产品基线，而是基于当前代码事实做一次可追溯的成熟度复核，并把结论同步回 `docs/dev/runtime-foundation.md`。

## 本轮复核范围

- 文档基线：`AGENTS.md`、`docs/dev/user-preferences.md`、`docs/product-design.md`、`docs/technical-design-supplement.md`、`docs/open-source-commercial-strategy.md`、`docs/dev/runtime-foundation.md`
- 后端主链抽查：`api/app/services/runtime.py`、`api/app/services/runtime_node_dispatch_support.py`、`api/app/services/agent_runtime.py`、`api/app/services/published_gateway.py`、`api/app/services/workflow_definitions.py`、`api/app/services/sensitive_access_control.py`
- 前端主链抽查：`web/components/workflow-editor-workbench.tsx`、`web/components/workflow-editor-workbench/use-workflow-editor-graph.ts`、`web/lib/get-workflow-publish.ts`、`web/components/workflow-editor-variable-form.tsx`、`web/app/page.tsx`
- 体量热点统计：按 `api/`、`web/` 下 `.py/.ts/.tsx` 行数排序，识别主业务热点与后续解耦优先级。

## 结论

### 1. 基础框架已经具备持续开发能力

- 后端主骨架已经不是“只有壳”的状态：`RuntimeService` 已收口为 workflow version / compiled blueprint / run / event 的执行入口，真正的节点准备、dispatch、graph、progress、lifecycle 已下沉到 mixin 和 helper，说明运行时骨架已经写成可扩展结构，而不是单文件原型。
- `runtime.py` 在执行入口就明确拦截 MVP 尚未支持的 `loop`，没有把未完成能力伪装成已支持，这与产品文档强调的“MVP 诚实性”一致。
- 发布层也不是一条临时通路：`published_gateway.py` 已把 binding resolver、cache orchestrator、invocation recorder、response builder、binding invoker 拆开，说明对外协议面已经进入可持续演进状态，而不是后续必须重写的 demo 层。
- 工作流定义层已经把 schema、tool reference、publish version reference、variable validation、node support status 明确收口到结构化校验链，说明后续编辑器、发布治理、插件兼容可以继续建立在同一份 IR 事实上推进。

### 2. 架构方向基本满足扩展性、兼容性与安全治理要求

- 扩展性：`plugin_runtime.py` 只是 facade，compat adapter registry、proxy、execution contract、dispatch planner 已拆到独立模块，说明 Dify 插件兼容没有反向污染核心 runtime。
- 兼容性：产品文档要求“内部坚持 `7Flows IR`，外部协议通过适配层映射”，当前代码实现与之基本一致；无论是 published gateway 还是 plugin runtime，都没有看到让 OpenAI / Anthropic / Dify 协议直接主导内部 workflow 语义的反向耦合。
- 安全性：敏感访问主链已经形成统一入口，`SensitiveAccessControlService` 负责 request / approval / notification / resume 编排，`sensitive_access` route 只是 HTTP contract，方向上符合“统一运行时能力，不散落在业务代码中”的设计要求。
- 可靠性与稳定性：当前主链已有较高测试覆盖，且真实验证通过 `api/.venv/Scripts/uv.exe run pytest -q` 的 `300 passed` 与 `web/pnpm exec tsc --noEmit`。因此“可以继续推进功能闭环”的判断有代码证据支撑，不只是文档推演。

### 3. 当前还不应触发人工逐项界面设计/验收通知

- 虽然项目已经具备持续开发骨架，但仍有明显未完成能力：`loop` 尚未开放执行、waiting callback 仍需进一步补自动唤醒主链、skill catalog 仍停留在设计基线、编辑器仍缺 schema builder 与敏感访问策略入口。
- 因此当前阶段仍属于“继续完成产品闭环”的开发期，而不是“只剩人工逐项界面设计”的验收期；本轮不触发用户指定的通知脚本。

## 主要风险与后续优先级

### P0：继续补 waiting / callback / operator 闭环

- 运行时已经有 waiting、resume、callback ticket 与 run event 基础，但距离产品要求的完整 operator 闭环还差 scheduler、callback bus、失败路径解释与更稳定的人工/AI 协作恢复链路。
- 这是最接近“用户层 + AI 协作层 + AI 治理层”共同闭环的缺口，优先级高于继续铺新页面。

### P1：继续拆真实业务热点，避免复杂度回流

- 本轮统计里，测试文件很长属于正常验证沉淀；真正要持续警惕的是以下真实业务热点：
  - `api/app/services/runtime_node_dispatch_support.py`
  - `api/app/services/agent_runtime.py`
  - `api/app/services/run_trace_views.py`
  - `api/app/services/workspace_starter_templates.py`
  - `web/lib/get-workflow-publish.ts`
  - `web/components/workflow-editor-variable-form.tsx`
  - `web/components/workflow-editor-workbench/use-workflow-editor-graph.ts`
- 这些文件并没有坏到必须立即重写，但都已经达到“继续加功能时要优先沿 helper / hook 边界拆”的级别，否则后续发布治理、editor、runtime 会重新长回单体热点。

### P1：继续做产品主闭环，而不是横向铺摊子

- 用户层：继续补 workflow editor、publish governance、run diagnostics、approval inbox 的真实可用性。
- AI 与人协作层：继续补 trace / replay / waiting lifecycle / callback resume，让人和 AI 消费同一份运行事实。
- AI 治理层：继续把 sensitive access policy explanation、notification health、publish export access、credential/context/tool access 收到同一治理主链。
- 这三层现在都已经有基础骨架，说明项目可以继续闭环推进，而不是需要先回头重搭框架。

## 验证

- `cd api; .\.venv\Scripts\uv.exe run pytest -q`
  - 结果：`300 passed`
- `cd web; pnpm exec tsc --noEmit`
  - 结果：通过

## 结论性判断

- 当前基础框架已经写好到足以支撑持续功能开发。
- 当前架构方向总体满足后续插件扩展、兼容演进、基础可靠性/稳定性/安全治理要求。
- 当前真正的工程重点不是“缺基础框架”，而是“继续围绕主业务闭环推进，同时持续拆热点，避免复杂度回流”。
