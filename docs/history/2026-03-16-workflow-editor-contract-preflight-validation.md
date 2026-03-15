# 2026-03-16 Workflow Editor Contract Preflight Validation

## 背景

- 用户要求先按 `AGENTS.md` 约定阅读 `docs/dev/user-preferences.md`、`docs/product-design.md`、`docs/technical-design-supplement.md`、`docs/dev/runtime-foundation.md`，再结合最近 Git 提交、当前代码骨架与文档基线，判断项目是否还能持续推进主业务完整度，并基于优先级继续开发、补记录。
- 最近一次提交是 `c1de162 feat: validate workflow contract schemas`。这轮提交已经把 workflow 保存链路里的 node / publish contract schema 校验补到后端 `create/update` 主链，解决了“错误 contract 可以先持久化，后续 publish / runtime 才暴露”的问题。
- 继续顺着这条主线往前看，前端 workflow editor 里的 Node contract 与 publish draft 仍主要停留在“JSON.parse + 必须是对象”的层级，保存前也只拦 planned / unknown node type，不会在本地提前暴露 contract 结构错误。

## 项目现状判断

### 1. 当前基础框架是否已经写好

- 结论：**基础框架已经达到可持续功能开发阶段，不需要回退重搭。**
- 依据：后端已经具备 `workflow -> workflow_version -> compiled_blueprint -> run / node_run / run_events` 的主链；发布侧已经形成 published surface、API key、activity/detail、cache inventory、callback waiting/resume 等治理入口；前端已经形成 workflow editor、workspace starter library、run diagnostics 与 publish panel 的基础工作台骨架。
- 这意味着当前项目不是“只有技术底座的空壳”，而是已经进入“围绕真实主链补齐一致性、可用性与治理细节”的阶段。

### 2. 最近一次 Git 提交是否需要衔接

- 结论：**需要直接衔接。**
- 原因：后端 `contract schema validation` 已经落地，但 editor 侧如果继续只在保存时依赖后端 `422`，会让用户体验停留在“保存失败后才知道 contract 错了”，也会让 Node contract / publish draft 的结构化表单与保存主链之间出现断层。
- 因此这轮优先补前端 preflight validation，而不是立刻转去做更重的 runtime / sandbox 大项。

### 3. 架构是否满足后续功能开发、扩展性、兼容性、可靠性与安全性

- 结论：**总体满足，但当前重点已从“能不能搭起来”转成“各主链是否继续收口一致”。**
- 内核层面仍保持 `7Flows IR + runtime + publish + trace + compat` 主事实，没有退化成 OpenClaw 专属壳层，也没有让 Dify DSL 反向主导内部模型。
- 插件/兼容层边界已通过 `plugin_runtime` / compat adapter / workflow library catalog 与独立 published gateway 服务继续分层，后续仍具备扩展性。
- 可靠性与稳定性当前最需要补的是“前后端校验一致性”“运行态隔离主链”“敏感访问统一闭环”“waiting callback 操作面”这几条线，而不是重新发明新的模型层。
- 安全性方向上，敏感访问控制、credential store、tool gateway gating、trace export access 已经入链，但真实通知 worker / inbox、publish export 入口与更完整 operator 控制面仍是 P0。

### 4. 哪些文件已经明显过长、后续适合继续拆层

- 后端热点仍主要集中在：`api/app/api/routes/workspace_starters.py`、`api/app/services/runtime_node_dispatch_support.py`、`api/app/services/agent_runtime_llm_support.py`、`api/app/services/agent_runtime.py`、`api/app/services/run_views.py`、`api/app/services/workflow_library_catalog.py`。
- 前端热点仍主要集中在：`web/lib/get-workflow-publish.ts`、`web/components/workflow-editor-workbench/use-workflow-editor-graph.ts`、`web/components/workspace-starter-library.tsx`、`web/components/workflow-editor-publish-endpoint-card.tsx`。
- 这些热点大多已经从“单文件全堆叠”进入“开始拆层但还没拆完”的阶段；当前最稳妥的推进方式仍是沿主业务链逐步拆，而不是为了“文件太长”先做脱离业务价值的大重构。

## 本轮目标

1. 让 workflow editor 在本地就能识别与后端一致的 contract schema 结构错误。
2. 让 Node contract、publish draft 与保存 / workspace starter 沉淀两条入口共享同一套最小 contract 规则。
3. 继续把“上次提交的 server-side contract validation”收成完整的前后端一致体验。

## 实现

### 1. 新增前端共享 contract validator

- 新增 `web/lib/workflow-contract-schema-validation.ts`。
- 语义与后端 `api/app/schemas/workflow_contract_validation.py` 保持一致，覆盖当前真正会消费的结构：
  - `type`
  - `properties`
  - `required`
  - `items`
  - `additionalProperties`
  - `allOf` / `anyOf` / `oneOf`
  - `not`
  - `enum`
- 同时补了 `buildWorkflowDefinitionContractValidationIssues()`，用于 workflow save / starter save 前统一扫描当前 definition。

### 2. Node contract 表单改成“本地预检 + 分字段报错”

- `web/components/workflow-node-config-form/node-io-schema-form.tsx` 不再只做 `JSON.parse`。
- `inputSchema` / `outputSchema` 现在会分别复用共享 validator，并保留各自独立的错误消息，避免一个字段的错误覆盖另一个字段。
- 文案也明确成“复用与后端保存链路一致的最小 contract 校验”。

### 3. Publish draft 改成“编辑即校验 + 汇总即校验”

- `web/components/workflow-editor-publish-form-validation.ts` 现在会把 `inputSchema` / `outputSchema` 一起纳入现有 publish draft validation issue 列表。
- `web/components/workflow-editor-publish-form.tsx` 在 blur 应用 schema 字段时，会先走共享 validator，再写回本地 draft。
- 结果是：publish draft 不再只在 alias/path/workflowVersion 等元数据层做校验，而是连 contract 结构也能在前端先暴露出来。

### 4. 保存前阻断补到 workflow / workspace starter 两条主链

- `web/components/workflow-editor-workbench.tsx` 现在会在 planned / unknown node guard 之外，再叠加 contract schema preflight。
- `保存 workflow` 与 `保存为 workspace starter` 共用同一套阻断消息，不再等后端 `422` 才知道 definition 里还有 contract 问题。
- `web/components/workflow-editor-workbench/workflow-editor-hero.tsx` 同步补了 `contract issues` 提示与更新后的保存策略文案。

## 影响范围

- `web/lib/workflow-contract-schema-validation.ts`
- `web/components/workflow-node-config-form/node-io-schema-form.tsx`
- `web/components/workflow-editor-publish-form-validation.ts`
- `web/components/workflow-editor-publish-form.tsx`
- `web/components/workflow-editor-workbench.tsx`
- `web/components/workflow-editor-workbench/workflow-editor-hero.tsx`
- `docs/dev/runtime-foundation.md`

## 验证

在 `web/` 目录执行：

```powershell
pnpm lint
pnpm exec tsc --noEmit
```

在仓库根目录执行：

```powershell
git diff --check
```

在 `api/` 目录执行：

```powershell
.\.venv\Scripts\uv.exe run pytest -q tests/test_workflow_routes.py
```

结果：

- `pnpm lint`：通过
- `pnpm exec tsc --noEmit`：通过
- `git diff --check`：通过
- `pytest -q tests/test_workflow_routes.py`：通过，`34 passed`

## 结论与下一步

- 当前项目基础框架已经足够支撑继续推进产品设计目标，不需要怀疑“底座是否还能支撑后续功能”；真正的工作重心是继续收口各主链的一致性与治理密度。
- 这轮是对最近一次提交的直接衔接：后端已经会拒绝非法 contract，前端现在也能在编辑与保存前提前发现并阻断，避免 save-time surprise。
- 当前项目仍未进入“只剩人工逐项界面设计/验收”的阶段，因此本轮不触发通知脚本。
- 下一步优先顺序：
  1. 继续把 Node contract / publish draft 从“JSON 文本框 + 最小 validator”推进到更清晰的 schema builder 与 advanced JSON 分层。
  2. 继续补 workflow editor 的 binding existence / reference 校验，让 tool / publish draft 与真实 catalog / version 事实进一步对齐。
  3. 回到 P0 主线，继续推进真实 `sandbox` / `microvm` adapter、敏感访问统一闭环与 `WAITING_CALLBACK` 的 operator / inbox 落点。
