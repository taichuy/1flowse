# 2026-03-14 Run Diagnostics Panel Split And Status Review

## 背景

- 用户要求先通读 `AGENTS.md`、`docs/dev/user-preferences.md`、`docs/product-design.md`、`docs/technical-design-supplement.md`、`docs/dev/runtime-foundation.md`，结合最近一次 Git 提交判断当前项目是否需要继续衔接主线，再基于优先级继续推进并同步文档。
- 最近一次 Git 提交 `0500e87 refactor: 更新用户偏好以主动通知人工界面验收阶段` 只修改了 `docs/dev/user-preferences.md`，属于协作偏好更新，不是新的功能主线。
- 真正需要衔接的最近功能提交是 `6c3b10b refactor: split runtime node support layers`。该提交已经把 runtime 主链继续收口到 support mixins，说明本轮不应回退去重复治理 runtime 主文件，而应转向新的结构热点。
- 结合当前代码体量和运行时事实，`web/components/run-diagnostics-panel.tsx` 已成为最明显的前端热点；同时 `api/app/api/routes/published_gateway.py`、`web/components/workflow-editor-workbench.tsx`、`web/components/run-diagnostics-execution-sections.tsx` 仍是后续需要继续治理的长文件。

## 本轮判断

### 1. 是否需要衔接上一次提交

- 需要衔接，但不是衔接 `0500e87` 这类文档偏好提交，而是要衔接 2026-03-14 连续几轮 runtime 结构治理后的新热点迁移。
- 当前主线判断是：runtime 后端骨架已经足够支撑继续推进主业务完整度，新的优先级应该转向前端诊断面板拆层、结构化节点配置补齐、发布路由继续解耦，以及 `waiting callback` / scheduler 闭环。

### 2. 基础框架是否已经写到可继续开发主业务

- 是。当前后端已经具备 workflow version、compiled blueprint、run/node run/run events、trace、resume、published endpoint、API key、cache、credential、artifact/evidence 等基础事实层。
- 前端也已具备工作台、workflow editor 入口、publish 面板、run diagnostics、workspace starter、plugin registry、credential store 等主干界面骨架。
- 这说明项目已经不是“只有设计图”的状态，而是具备继续做功能性开发的稳定底座。

### 3. 架构是否满足扩展性、兼容性、可靠性、稳定性、安全性

- **扩展性**：总体满足。`RuntimeService`、published gateway、agent runtime、context/artifact/tool gateway 都已按职责分层，继续拆分有现实基础。
- **兼容性**：总体方向正确。当前兼容层仍坚持“7Flows IR 优先，外部协议旁挂映射”，没有让 OpenAI / Anthropic / Dify 反向主导内部模型。
- **可靠性 / 稳定性**：具备主链，但还没到收尾阶段。`loop` 仍未开放执行，`WAITING_CALLBACK` 缺后台自动唤醒与完整 callback bus，相关闭环还需补齐。
- **安全性**：边界方向正确，但仍需持续推进。沙盒、凭据、插件代理和发布 API key 已有基础设施，不过还需要继续通过运行时隔离和发布治理细化来加固。

### 4. 当前最明显的长文件与解耦判断

- `web/components/run-diagnostics-panel.tsx`：本轮前 688 行，已适合拆成稳定区块。
- `api/app/api/routes/published_gateway.py`：516 行，native / openai / anthropic 多协议入口集中在一个 route 文件，后续应按协议面继续拆分。
- `web/components/workflow-editor-workbench.tsx`：528 行，虽然已拆出若干子组件，但状态编排和运行 overlay 仍偏重。
- `web/components/run-diagnostics-execution-sections.tsx`：477 行，execution/evidence 详情区块后续也适合继续拆层。
- `web/components/workflow-node-config-form/tool-node-config-form.tsx`：339 行，说明节点配置完整度仍在推进中，但还没有膨胀到本轮必须优先处理的程度。

## 本轮实现

### 1. 拆分 `run-diagnostics-panel`

- 把共享 helper 与 `PayloadCard` 提取到 `web/components/run-diagnostics-panel/shared.tsx`。
- 把 run summary、event overview、node timeline 抽到 `web/components/run-diagnostics-panel/overview-sections.tsx`。
- 把 trace filter / export 表单抽到 `web/components/run-diagnostics-panel/trace-filters-section.tsx`。
- 把 trace summary、cursor 翻页与 event list 抽到 `web/components/run-diagnostics-panel/trace-results-section.tsx`。
- `web/components/run-diagnostics-panel.tsx` 收口为 orchestrator，主文件从 688 行降到 152 行。

### 2. 同步当前优先级判断

- 本轮没有触碰 runtime 主链行为，也没有再把职责回流到 `runtime.py` 或 published gateway service。
- 文档优先级将据此调整：前端诊断面板主壳层不再是主要热点，下一阶段优先转向发布路由拆分、工作流编辑器与节点配置完整度、callback scheduler 闭环。

## 影响范围

- `web/components/run-diagnostics-panel.tsx`
- `web/components/run-diagnostics-panel/shared.tsx`
- `web/components/run-diagnostics-panel/overview-sections.tsx`
- `web/components/run-diagnostics-panel/trace-filters-section.tsx`
- `web/components/run-diagnostics-panel/trace-results-section.tsx`
- `docs/dev/runtime-foundation.md`

## 验证

- `cd web && pnpm exec tsc --noEmit`
- 结果：通过。
- `cd web && pnpm lint`
- 结果：失败，但失败源自仓库既有问题 `web/components/credential-store-panel.tsx` 的 `react/no-unescaped-entities`，与本轮改动无关。

## 人工通知判断

- 当前项目仍未达到“只剩人工逐项界面设计测试 / 人工验收”的阶段。
- 因此本轮不触发 `node "e:\code\taichuCode\ai-presson-wen\aionui\notice\kill-port-8050.js"`。

## 结论

- 上一次真正需要衔接的功能主线已经被延续：runtime 结构治理不需要原地打转，热点已成功转移到前端诊断与后续功能闭环。
- 基础框架已经满足继续推进产品设计目标，但仍需诚实面对未完成边界：`loop`、callback scheduler / bus、前端配置完整度、发布路由拆层与沙盒硬化都还在路上。
- 当前项目的正确推进方式不是停下来做纯界面润色，而是继续围绕“可编排、可调试、可发布、可兼容、可追溯”补齐真实闭环。

## 下一步规划

1. **P0：拆分 `api/app/api/routes/published_gateway.py`**
   - 按 native / openai / anthropic surface 拆 route，保留共享 header / streaming / api key helper，避免多协议入口继续堆在单文件里。
2. **P1：继续补齐 workflow editor 与节点配置完整度**
   - 优先让 provider / model / tool / publish 配置保持结构化，而不是继续堆进单组件。
3. **P1：补 `WAITING_CALLBACK` 的后台唤醒闭环**
   - 让 callback ticket、scheduler、resume orchestration 形成更稳定的 durable execution 主链。
4. **P1：继续拆分诊断详情层**
   - 后续可治理 `web/components/run-diagnostics-execution-sections.tsx`，继续保持摘要优先、详情可钻取。
