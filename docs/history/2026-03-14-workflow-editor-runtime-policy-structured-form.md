# 2026-03-14 Workflow Editor Runtime Policy Structured Form

## 背景

- 用户要求先通读 `AGENTS.md`、`docs/dev/user-preferences.md`、`docs/product-design.md`、`docs/technical-design-supplement.md` 与 `docs/dev/runtime-foundation.md`，再判断项目现状、最近一次 Git 提交是否需要衔接、基础框架是否已经足够支撑后续功能性开发，以及哪些代码热点仍应继续解耦。
- 当前仓库最近一次提交为 `9311898 refactor: split workflow editor workbench state`，已把 `workflow-editor-workbench` 主文件拆成 orchestrator + graph hook + run overlay hook，因此本轮最自然的衔接方向不是再做结构性大拆，而是继续沿 `runtime-foundation` 的 P0 主线补 workflow editor 的结构化配置完整度。
- 在实际代码里，`llm_agent`、`tool`、`mcp_query`、`condition/router` 已有结构化配置表单，但 `runtimePolicy` 仍停留在纯 JSON 文本编辑，这和运行时已经支持的 retry / join 事实层不匹配，也会放大编辑器阶段的误填风险。

## 现状判断

### 1. 最近一次 Git 提交是否需要衔接

- 需要衔接。
- 上一轮已经把 `workflow-editor-workbench.tsx` 收口为组合层，如果这一轮不继续补配置侧能力，编辑器仍会停留在“结构拆开了，但关键业务配置还靠 JSON”的半完成状态。
- 因此本轮直接衔接 `workflow editor` 的 P0 主线，而不是跳去做新的旁支功能。

### 2. 基础框架是否已经足够支撑功能性开发

- 是。
- 后端已具备 workflow definition/version、compiled blueprint、runtime、run/node_run/run_event、artifact、published surface、API key、credential、plugin registry、callback ticket 等基础事实层。
- 前端已具备工作台首页、workflow library、workflow editor、run diagnostics、publish governance、workspace starters、plugin registry、credential store 等主骨架。
- 结论仍然是：项目基础框架足够继续推进产品设计要求与主要业务闭环，但还没有进入“只剩人工界面设计”阶段。

### 3. 架构是否满足扩展性、兼容性、可靠性、稳定性与安全性

- **扩展性 / 兼容性**：总体满足。内部仍由 `7Flows IR` 驱动，Dify 插件兼容和 OpenAI / Anthropic surface 仍是旁挂适配层，没有反向绑架内部模型。
- **可靠性 / 稳定性**：能继续开发，但 durable execution 仍有关键缺口，`WAITING_CALLBACK` 还需后台唤醒与完整 callback bus / scheduler 主链。
- **安全性**：方向正确。显式上下文授权、artifact 引用、credential、publish API key、sandbox 边界都已有事实落点，但 sandbox 执行与发布治理仍需持续硬化。
- **文件体量**：主热点仍集中在 `api/app/services/published_protocol_streaming.py`、`api/app/services/published_gateway.py`、`web/components/run-diagnostics-execution-sections.tsx` 等区域；本轮没有新增新的大文件热点。
- **人工界面设计阶段判断**：当前还没到“只剩人工逐项界面设计”的阶段，因此本轮不执行 `node "e:\code\taichuCode\ai-presson-wen\aionui\notice\kill-port-8050.js"`。

## 本轮实现

### 1. 为 workflow editor 补上结构化 runtime policy 表单

- 新增 `web/components/workflow-node-config-form/runtime-policy-form.tsx`，把 `runtimePolicy.retry` 与 `runtimePolicy.join` 从纯 JSON 文本提升为结构化配置段。
- retry 区块已显式暴露 `maxAttempts`、`backoffSeconds`、`backoffMultiplier`，并统一把历史平铺重试字段规范化写回 `runtimePolicy.retry`。
- join 区块已显式暴露 `mode`、`onUnmet`、`mergeStrategy`，并在 `all` 模式下支持勾选 required upstream nodes。

### 2. 用实际画布入边约束 join 配置来源

- `WorkflowEditorInspector` 新增 `edges` 透传给 runtime policy 表单。
- join 的候选来源不再让用户随意输入任意节点 ID，而是收敛到当前节点的实际入边来源，和后端 `join.requiredNodeIds` 必须引用 incoming sources 的校验保持一致。
- `trigger` 或当前尚无入边的节点会直接显示不可用提示，避免用户误以为 join 已可配置生效。

### 3. 让结构化编辑与高级 JSON 共用同一条状态链

- `use-workflow-editor-graph.ts` 新增 `updateNodeRuntimePolicy()`，供结构化表单直接写本地画布状态。
- 原有 `handleNodeRuntimePolicyChange()` 仍保留，继续负责高级 JSON 文本框的解析与错误提示。
- 这样保持了“结构化优先、JSON 兜底”的编辑边界，不需要再把所有复杂配置重新塞回单一 textarea。

## 影响范围

- `web/components/workflow-node-config-form/runtime-policy-form.tsx`
- `web/components/workflow-editor-inspector.tsx`
- `web/components/workflow-editor-workbench.tsx`
- `web/components/workflow-editor-workbench/use-workflow-editor-graph.ts`
- `docs/dev/runtime-foundation.md`

## 验证

- `cd web; pnpm exec tsc --noEmit`
- 结果：通过。
- `cd web; pnpm lint`
- 结果：未通过，但失败点仍来自未改动文件 `web/components/credential-store-panel.tsx` 中既有的 `react/no-unescaped-entities` 报错，不是本轮 runtime policy 表单引入的新问题。

## 结论

- 最近一次 Git 提交需要衔接，本轮已沿 `workflow editor` 的 P0 主线继续推进，而不是另起一条新主线。
- 当前基础框架仍然足够支撑主要功能继续开发，也足够支撑插件扩展性、兼容层演进和运行时可靠性治理，但 durable callback、publish streaming/service 治理和编辑器配置完整度仍未完成。
- 本轮改动的价值不在于“新增一个 UI 小表单”，而在于把已经落地的 runtime 语义重新拉回到结构化编辑链路里，减少后续业务推进继续依赖 JSON 文本的摩擦。

## 下一步规划

1. **P0：继续补 workflow editor 的结构化配置完整度**
   - 优先把 input/output schema、tool policy、publish config 等仍停留在 JSON 驱动的配置补成稳定 section。
2. **P1：补齐 `WAITING_CALLBACK` 后台唤醒闭环**
   - 继续把 callback ticket、scheduler 和 resume orchestration 衔接成 durable execution 主链。
3. **P1：继续治理 run diagnostics 详情层**
   - 优先拆 `web/components/run-diagnostics-execution-sections.tsx` 与 `trace-results-section.tsx`，保持摘要优先、详情可钻取。
4. **P1：继续治理 published service / streaming 热点**
   - 下一阶段继续收紧 `api/app/services/published_gateway.py` 与 `api/app/services/published_protocol_streaming.py` 的 surface orchestration 和 SSE 映射职责。
