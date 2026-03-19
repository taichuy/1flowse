# 2026-03-16 架构成熟度复核刷新

## 背景

- 用户要求重新阅读 `AGENTS.md`、`docs/dev/user-preferences.md`、产品/技术/开源策略文档与 `docs/dev/runtime-foundation.md`，并结合当前实现再次判断：基础框架是否已经写好、是否足以支撑持续功能开发、插件扩展与兼容演进、可靠性/稳定性/安全治理，以及哪些代码热点仍需要继续解耦。
- 本轮目标是基于当前代码和验证结果做一次刷新复核，把“可继续推进主业务闭环，但尚未进入人工逐项界面验收阶段”的判断补成最新留痕。

## 复核范围

- 文档基线：`AGENTS.md`、`docs/dev/user-preferences.md`、`docs/product-design.md`、`docs/technical-design-supplement.md`、`docs/open-source-commercial-strategy.md`、`docs/dev/runtime-foundation.md`
- 后端抽查：`api/app/main.py`、`api/app/services/runtime.py`、`api/app/services/runtime_node_dispatch_support.py`、`api/app/services/agent_runtime.py`、`api/app/services/tool_gateway.py`、`api/app/services/published_gateway.py`、`api/app/services/sensitive_access_control.py`、`api/app/services/run_trace_views.py`、`api/app/services/runtime_execution_adapters.py`、`api/app/services/workflow_definitions.py`
- 前端抽查：`web/app/page.tsx`、`web/components/workflow-editor-workbench.tsx`、`web/components/workflow-editor-workbench/use-workflow-editor-validation.ts`、`web/lib/get-workflow-publish.ts`、`web/components/workflow-editor-variable-form.tsx`
- 结构热点统计：按 `api/app`、`web/app`、`web/components`、`web/lib` 下 `.py/.ts/.tsx` 行数复核业务热点

## 刷新结论

### 1. 基础框架已经写好到足以承接持续开发

- 后端已经形成稳定主链：`api/app/main.py` 只负责应用装配与路由挂载，`RuntimeService` 作为 facade 负责 workflow 执行入口，再通过 mixin 与专用 service 下沉 runtime graph、dispatch、progress、lifecycle、tool gateway、agent runtime、publish gateway、sensitive access 等能力。
- `api/app/services/runtime_execution_adapters.py` 与 `api/app/services/workflow_definitions.py` 已把“执行能力诚实性”和“定义保存前 guard”前移到统一入口，说明当前不是“定义能写但运行时必炸”的松散骨架，而是已具备持续演进的最小治理基线。
- 前端也不再只是诊断壳：首页已汇总 health / workflows / credentials / sensitive access 摘要，workflow editor 已接到 validation/persistence hook，publish 面板与 inbox 页面也已连上真实 API，因此用户层最小操作面已形成。

### 2. 当前架构方向满足扩展性、兼容性、可靠性、安全性的继续演进门槛

- 扩展性：plugin compat、publish gateway、workflow definition guard、run diagnostics、sensitive access 都已拆成独立 service/helper，而不是绑死在单个“超级 runtime 文件”里。
- 兼容性：从产品设计到代码实现都仍然坚持 `7Flows IR` 为内核，Dify 兼容、OpenAI/Anthropic 发布面都通过适配与映射进入，没有看到外部协议反向主导内部 IR 的迹象。
- 可靠性与稳定性：本轮重新验证后端 `300 passed`、前端类型检查通过、前端 lint 通过；当前“可继续功能开发”的判断有真实验证支撑。
- 安全性：credential/context/tool/published detail access control 已逐步收口到统一 sensitive access 主链，运行时、审批票据、通知投递和 operator inbox 的边界保持一致，没有再额外长出第二套审批事实源。

### 3. 三层业务闭环可以继续推进，但都还没有达到“只剩界面设计”阶段

- 用户层：workflow editor、publish panel、workspace starter、approval inbox 已可继续补真实操作闭环，但 editor 的 schema builder、publish governance 细化和 field-level UX 仍需推进。
- AI 与人协作层：run detail、trace export、callback waiting lifecycle、approval timeline 已具备共享事实入口，但 waiting callback 的 operator explanation、跨入口排障与恢复链仍需增强。
- AI 治理层：统一 sensitive access 主链已贯通 credential/context/tool/published detail 的关键路径，但 policy explanation、channel preset/default target、批量治理与 published surface 解释仍需补齐。
- 因此当前仍属于“继续完善产品闭环”的开发期，不触发用户要求的人工逐项界面设计通知脚本。

## 当前主要热点

- 后端热点：`api/app/services/workspace_starter_templates.py`、`api/app/services/runtime_node_dispatch_support.py`、`api/app/services/agent_runtime.py`、`api/app/services/run_trace_views.py`
- 前端热点：`web/lib/get-workflow-publish.ts`、`web/lib/workflow-tool-execution-validation.ts`、`web/components/workflow-editor-variable-form.tsx`、`web/components/workflow-editor-workbench/use-workflow-editor-graph.ts`
- 这些文件还没有失控到必须立即重写，但都已经进入“继续加功能时优先沿 helper / hook / presenter 边界继续下沉”的阶段，否则后续 waiting policy、publish diagnostics、starter governance、editor 表单状态会重新堆回单点热点。

## 优先级建议

1. P0：继续补 waiting / callback / operator 闭环，把 shared fact、resume、排障解释、published callback drilldown 收成一致主链。
2. P0：继续扩统一 sensitive access 治理，把 policy explanation、channel preset/default target、published/export 侧治理说明补齐。
3. P1：继续拆 runtime/editor/publish/starter 热点文件，优先处理 `runtime_node_dispatch_support.py`、`agent_runtime.py`、`get-workflow-publish.ts`、`workflow-editor-variable-form.tsx`。
4. P1：继续补 workflow editor 与 publish governance 的真实闭环，而不是横向再铺新页面。
5. P2：在 runtime 与治理主链更稳后，再推进轻量 Skill Catalog 与更明确的 Team/Enterprise 领域模型。

## 验证

- `cd api; .\.venv\Scripts\uv.exe run pytest -q`
  - 结果：`300 passed`
- `cd web; pnpm exec tsc --noEmit`
  - 结果：通过
- `cd web; pnpm lint`
  - 结果：通过（仅有 Next.js 关于 `next lint` 即将废弃的上游提示，无实际 lint 错误）

## 结论性判断

- 当前项目基础框架已经足够支撑后续功能性开发，不需要回头重搭主骨架。
- 当前架构方向总体满足插件扩展性、兼容性、可靠性、稳定性、安全性继续演进的要求。
- 当前最重要的工程动作不是“重构整个架构”，而是“沿现有主线继续补主业务闭环，并持续拆热点避免复杂度回流”。
