# 2026-03-16 功能承载度与解耦优先级复核

## 背景

- 用户要求重新阅读 `AGENTS.md`、`docs/dev/user-preferences.md`、`docs/product-design.md`、`docs/technical-design-supplement.md`、`docs/open-source-commercial-strategy.md` 与 `docs/dev/runtime-foundation.md`，并结合当前实现判断：基础框架是否已经写好、是否满足持续功能开发、插件扩展性、兼容性、可靠性、稳定性、安全性，以及哪些代码文件已进入需要持续解耦的阶段。
- 本轮目标不是重写架构，而是给出现阶段是否“可以继续沿主线推进”的明确判断，并把优先级、热点和验证结果补成可追溯事实。

## 复核输入

- 文档基线：`AGENTS.md`、`docs/dev/user-preferences.md`、`docs/product-design.md`、`docs/technical-design-supplement.md`、`docs/open-source-commercial-strategy.md`、`docs/dev/runtime-foundation.md`
- 后端抽查：`api/app/services/runtime.py`、`api/app/services/runtime_node_dispatch_support.py`、`api/app/services/agent_runtime.py`、`api/app/services/run_trace_views.py`、`api/app/services/workspace_starter_templates.py`、`api/app/api/routes/workflows.py`、`api/app/api/routes/system.py`
- 前端抽查：`web/app/page.tsx`、`web/components/workflow-editor-workbench.tsx`、`web/lib/get-workflow-publish.ts`、`web/lib/workflow-tool-execution-validation.ts`、`web/components/workflow-editor-variable-form.tsx`
- 真实验证：`api/.venv` + `uv` 的后端测试、`web` 侧类型检查与 lint

## 复核结论

### 1. 基础框架已经写到可持续开发阶段

- 当前后端不是“只有模型和路由”的空壳：`RuntimeService` 已作为 facade 统筹 runtime run / graph / node preparation / dispatch / execution / lifecycle，多数横切能力继续下沉到 mixin 与独立 service。
- 发布、插件兼容、运行追踪、敏感访问控制、workspace starter、workflow definition guard 已经形成并行可演进的子域，不需要回头重搭主骨架。
- 前端也已具备最小产品操作面：首页工作台、workflow editor、publish panel、workspace starter 与 sensitive access inbox 都已接入真实 API，不再只是静态演示层。

### 2. 架构方向满足扩展性、兼容性与治理要求

- 扩展性：当前仍以 `7Flows IR` 为事实模型，外部兼容、发布协议与插件接入通过适配进入，没有出现第二套内部 DSL 或第二套执行引擎抢主控。
- 兼容性：Dify 兼容、OpenAI / Anthropic 发布面、workspace starter、tool catalog 与 workflow definition guard 之间的边界是清楚的，说明项目可以继续扩大 published surface，而不是先回收设计。
- 可靠性与稳定性：后端 `300 passed`，前端 `pnpm exec tsc --noEmit` 与 `pnpm lint` 通过，证明当前主链不是靠文档假设成立。
- 安全性：credential / context / tool / published invocation detail 继续围绕统一 sensitive access 主链收口，审批票据、通知分发、operator inbox 和 runtime gating 仍维持单一事实源。

### 3. 三层业务闭环已经可推进，但还没到“只剩界面设计”阶段

- 用户层：已有 workflow editor、publish、workspace starter、首页诊断与审批 inbox，可以继续推进真实业务闭环。
- AI 与人协作层：已有 run detail、trace export、callback waiting lifecycle、approval timeline、published invocation detail 等共享事实入口。
- AI 治理层：统一敏感访问控制已进入 credential / context read / tool invoke / published detail access 等关键路径。
- 但 operator explanation、waiting callback 的排障闭环、publish/editor 的细粒度体验和治理解释仍明显未完成，因此本轮不触发“需要人工逐项界面设计”通知脚本。

## 热点与解耦判断

### 后端热点

- `api/app/services/runtime_node_dispatch_support.py`：约 607 行，仍承担较重的 dispatch/orchestration 分支，后续 waiting policy、execution capability 或 callback 细节继续叠加时最容易回流成单点热点。
- `api/app/services/workspace_starter_templates.py`：约 626 行，聚合了 starter catalog、source、governance 与模板视图组装，继续扩 bulk action 或 source sync 时应优先下沉 presenter/helper。
- `api/app/services/agent_runtime.py`：约 559 行，主链虽然已把 LLM support 分层，但 provider-specific finalize、tool loop 与 evidence 汇总继续增长时仍需要更细粒度 helper。
- `api/app/services/run_trace_views.py`：约 446 行，trace filter、cursor、serialize、event shaping 仍聚在一起；若后续继续补 published callback drilldown 与 operator explanation，应继续拆 presenter/export/filter 边界。

### 前端热点

- `web/lib/get-workflow-publish.ts`：约 499 行，已明显成为 publish diagnostics / exports / detail loader 的聚合点，适合继续拆 query helper 与 URL builder。
- `web/lib/workflow-tool-execution-validation.ts`：约 434 行，当前承担 tool execution capability 与 editor 阻断逻辑，后续再加 sandbox / backend capability 细节时应继续拆 shared rule/helper。
- `web/components/workflow-editor-variable-form.tsx`：约 420 行，已经进入“表单行为 + 结构化默认值 + validation feedback”混合阶段，适合往 field component / parser helper 继续拆。
- `web/components/workflow-editor-workbench.tsx` 当前约 230 行，已基本回到 shell 角色；真正的 editor 热点已转移到 `use-workflow-editor-validation.ts`、`use-workflow-editor-graph.ts` 与相关表单组件，说明现有解耦方向是有效的。

## 对“是否满足后续目标”的判断

### 功能性开发

- 满足。当前已经可以继续补 runtime / waiting / diagnostics / publish / editor / governance 的主业务闭环，不需要回头重做基础框架。

### 插件扩展性与兼容性

- 满足继续演进的门槛。compat adapter、publish mapping、workflow definition guard、tool catalog 与 runtime execution contract 之间边界基本清楚；当前问题更多是能力兑现深度，而不是模型方向错误。

### 应用可靠性与稳定性

- 具备继续推进条件。测试和静态检查通过，运行态主链已有统一的 run / node run / run event / approval / notification 事实源。
- 剩余风险主要在 waiting callback 的 operator 排障说明、published callback drilldown 和少数热点 service 的复杂度积累，而不是系统主链不稳。

### 安全性

- 方向正确且已有真实主链。敏感访问控制、审批、通知和 published detail access 并没有各自分裂成独立治理系统。
- 下一步重点是 explanation、preset/default target、跨入口治理动作，而不是再造第二套安全模型。

## 优先级建议

1. **P0：补 waiting / callback / operator 闭环**
   - 优先把 `WAITING_CALLBACK` 的排障说明、published callback drilldown、resume 相关 operator 入口补成一致主链。
2. **P0：继续扩统一 sensitive access 治理解释层**
   - 补 policy explanation、notification preset/default target、published/export 侧治理说明与批量动作。
3. **P1：继续拆后端 orchestration 热点**
   - 优先关注 `runtime_node_dispatch_support.py`、`workspace_starter_templates.py`、`agent_runtime.py`、`run_trace_views.py`。
4. **P1：继续拆前端 publish/editor 热点**
   - 优先关注 `get-workflow-publish.ts`、`workflow-tool-execution-validation.ts`、`workflow-editor-variable-form.tsx`。
5. **P1：继续补 workflow editor 与 publish governance 真实闭环**
   - 优先做 capability explanation、field-level focus/scroll、advanced JSON 与结构化表单边界，而不是先铺更多新页面。
6. **P2：在主业务闭环更稳后推进 Skill Catalog 与 Team/Enterprise 最小模型**
   - 保持 skill 为轻量认知注入层，治理模型为最小可实现领域边界，避免再次抢跑成第二套内核。

## 验证

- `cd api; .\.venv\Scripts\uv.exe run pytest -q`
  - 结果：`300 passed`
- `cd web; pnpm exec tsc --noEmit`
  - 结果：通过
- `cd web; pnpm lint`
  - 结果：通过（仅有 Next.js 关于 `next lint` 即将废弃的上游提示，无实际 lint 错误）

## 结论

- 当前项目基础框架已经写好到足以支撑持续功能开发。
- 当前架构总体满足后续插件扩展性、兼容性、可靠性、稳定性与安全性继续演进的要求。
- 当前最需要做的是按优先级继续补主业务闭环，并持续拆热点，避免复杂度重新回流到少数 service / helper / form 文件。
