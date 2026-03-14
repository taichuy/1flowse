# 2026-03-14 Published Gateway Route Split And Status Review

## 背景

- 用户要求先阅读 `AGENTS.md`、`docs/dev/user-preferences.md`、`docs/product-design.md`、`docs/technical-design-supplement.md`、`docs/dev/runtime-foundation.md`，了解项目现状、核对上一次 Git 提交是否需要衔接，并基于优先级继续开发、更新文档。
- 最近一次 Git 提交 `4774580 refactor: split run diagnostics panel sections` 主要完成前端 `run diagnostics` 面板拆层，并把 `runtime-foundation` 的优先级更新到“先拆 `published_gateway` route”。
- 因此本轮需要衔接该提交，但衔接方向不是继续停留在前端诊断壳层，而是兑现文档里已明确的 P0：拆分 `api/app/api/routes/published_gateway.py`。

## 本轮判断

### 1. 上一次 Git 提交做了什么，是否需要衔接

- `4774580` 已把 `web/components/run-diagnostics-panel.tsx` 从单体拆为 orchestrator + overview/filter/result 子区块，并同步更新当前事实文档。
- 该提交已经完成自己承诺的前端结构治理，不需要原地重复推进同一文件。
- 但它明确留下了新的后端优先级，因此本轮应继续衔接；否则 `runtime-foundation` 的 P0 会停留在文档里而没有落成代码事实。

### 2. 基础框架是否已经写好到足以继续推进主业务

- 是。当前后端已经具备 workflow version、compiled blueprint、run / node run / run event / artifact / tool call / ai call 等事实层，也具备 published endpoint、API key、cache、credential、trace、resume、callback ingress 等主链能力。
- 前端也已有工作台首页、workflow editor 入口、run diagnostics、publish 管理、workspace starter、plugin registry、credential store 等骨架。
- 项目已明显不是“只有设计稿和空框架”的阶段，而是具备继续做功能性开发的稳定基础。

### 3. 架构是否满足功能推进、扩展性、兼容性、可靠性、稳定性与安全性

- **功能推进**：满足。当前 `7Flows IR`、runtime 事件流、发布接口与诊断接口已经能承接持续迭代。
- **插件扩展性 / 兼容性**：总体方向正确。内部仍坚持 `7Flows IR` 优先，Dify / OpenAI / Anthropic 都是旁挂映射层，没有反向主导内部模型。
- **可靠性 / 稳定性**：具备主链，但仍未收尾。`loop` 还未开放执行，`WAITING_CALLBACK` 缺后台自动唤醒与完整 scheduler / callback bus，需要继续补 durable execution 闭环。
- **安全性**：方向正确但仍需强化。沙盒、凭据、发布 API key、artifact 引用、工具网关都已有基础，但还需要继续沿运行时隔离与发布治理做硬化。

### 4. 当前是否已进入“只剩人工界面设计”的阶段

- 否。尽管基础框架已足够支撑主业务持续推进，但 workflow editor 配置完整度、callback durable 闭环、发布 service/streaming 拆层和前端详情层治理都还在进行中。
- 因此本轮不触发 `node "e:\code\taichuCode\ai-presson-wen\aionui\notice\kill-port-8050.js"`。

## 本轮实现

### 1. 拆分 published gateway route 层

- 新增 `api/app/api/routes/published_gateway_shared.py`，集中承接 API key 提取、payload 构造、通用响应 header、SSE 响应包装与共享 `published_gateway_service`。
- 新增 `api/app/api/routes/published_gateway_native_routes.py`，收纳 native workflow / alias / path 的 sync 与 async surface。
- 新增 `api/app/api/routes/published_gateway_openai_routes.py`，收纳 OpenAI chat completions / responses 的 sync 与 async surface。
- 新增 `api/app/api/routes/published_gateway_anthropic_routes.py`，收纳 Anthropic messages 的 sync 与 async surface。
- `api/app/api/routes/published_gateway.py` 收口为 `/v1` 聚合入口并继续对外暴露 `published_gateway_service`，避免破坏现有测试与导入路径。

### 2. 结构收益

- 原先 516 行、同时承载三类协议 surface 的单文件 route 热点被消除。
- route 层现在按协议面拆分，更符合“路由保持薄、service 负责编排”的后端约束。
- 现有 published gateway service、streaming builder、protocol rejection 行为都保持不变，因此本轮是结构治理而不是行为重写。

## 影响范围

- `api/app/api/routes/published_gateway.py`
- `api/app/api/routes/published_gateway_shared.py`
- `api/app/api/routes/published_gateway_native_routes.py`
- `api/app/api/routes/published_gateway_openai_routes.py`
- `api/app/api/routes/published_gateway_anthropic_routes.py`
- `docs/dev/runtime-foundation.md`
- `docs/dev/user-preferences.md`

## 验证

- `cd api; . .\.venv\Scripts\Activate.ps1; uv run python -m compileall app\api\routes\published_gateway.py app\api\routes\published_gateway_shared.py app\api\routes\published_gateway_native_routes.py app\api\routes\published_gateway_openai_routes.py app\api\routes\published_gateway_anthropic_routes.py`
- 结果：通过。
- `cd api; . .\.venv\Scripts\Activate.ps1; uv run pytest tests/test_published_native_async_routes.py tests/test_published_protocol_async_routes.py tests/test_published_protocol_streaming.py`
- 结果：11 个测试全部通过。

## 结论

- 最近一次 Git 提交需要衔接，而且已经被正确衔接：前端诊断面板拆分之后，发布路由拆层这一步已经从优先级计划落成代码事实。
- 当前基础框架已经满足继续推进产品设计目标，但仍不能假装项目只剩界面润色；真正的后续主线仍应围绕编辑器完整度、durable callback、发布 service/streaming 治理和诊断详情层继续收口。

## 下一步规划

1. **P0：继续补节点配置与 workflow editor 完整度**
   - 优先把 provider / model / tool / publish 配置继续做成结构化配置段，并收紧 `web/components/workflow-editor-workbench.tsx` 的状态编排职责。
2. **P1：补齐 `WAITING_CALLBACK` 的后台唤醒闭环**
   - 把 callback ticket、scheduler、resume orchestration 衔接成更完整的 durable execution 主链。
3. **P1：继续治理 run diagnostics 详情层**
   - 可优先拆 `web/components/run-diagnostics-execution-sections.tsx` 与 `web/components/run-diagnostics-panel/trace-results-section.tsx`。
4. **P1：继续治理 published service / streaming 热点**
   - route 层已拆开，下一阶段可进一步收紧 `api/app/services/published_gateway.py` 与 `api/app/services/published_protocol_streaming.py` 的职责边界。
