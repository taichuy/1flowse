# 2026-03-16 项目现状复核（衔接 workspace starter state 解耦）

## 背景

- 用户要求重新阅读仓库协作基线、产品/技术/策略文档、用户偏好、`docs/dev/runtime-foundation.md` 与最近正式开发留痕，判断当前项目是否仍沿正确方向推进。
- 本轮重点是确认：最近一次提交是否需要衔接、基础框架是否足以支撑后续功能闭环、哪些热点文件仍应继续解耦，以及当前优先级是否需要更新。

## 本轮复核输入

- 规则与偏好：`AGENTS.md`、`docs/dev/user-preferences.md`
- 设计基线：`docs/product-design.md`、`docs/technical-design-supplement.md`、`docs/open-source-commercial-strategy.md`
- 当前事实：`docs/dev/runtime-foundation.md`、`README.md`
- 最近正式开发：
  - `cce1740 docs: record project status review and priorities`
  - `94ad5ed refactor: split workspace starter library state`
- 真实验证：
  - `api/.venv/Scripts/uv.exe run pytest -q`
  - `web/pnpm exec tsc --noEmit`

## 最近一次 Git 提交做了什么

- 最近一次正式提交是 `94ad5ed refactor: split workspace starter library state`。
- 该提交没有改变产品方向，也没有引入新的执行语义，而是继续沿“热点模块拆 state / helper、壳层保持轻量”的主线推进前端治理。
- 具体变化：
  - 新增 `web/components/workspace-starter-library/use-workspace-starter-library-state.ts`，接管 templates/filter/selection/form/message/bulk governance/source sync 的 library-level state orchestration。
  - `web/components/workspace-starter-library.tsx` 从原先的厚壳组件缩回到 panel 组装层。
  - `web/components/workspace-starter-library/shared.ts` 补了 validation issue 摘要等共享工具。
- 这次提交对应的正式开发留痕是 `docs/history/2026-03-16-workspace-starter-library-state-decoupling.md`。

## 是否需要衔接

- 需要，而且应继续顺着这条主线推进。
- 当前最近几次提交体现的是同一种工程治理动作，而不是方向摇摆：
  - 后端持续把 runtime / diagnostics / publish / compat 的热点 service 拆成 facade + helper。
  - 前端持续把 workflow editor / workspace starter / publish inspector 的厚壳组件拆成 state hook、action helper 与 section component。
  - 文档持续把“当前事实、热点与下一步优先级”收敛到 `docs/dev/runtime-foundation.md`，并把单轮决策沉淀到 `docs/history/`。
- 因此当前不应重新怀疑“底座是否没搭好”，而应继续在既有骨架上补闭环、补治理解释、补 operator 体验。

## 基础框架是否已足以承接后续开发

- 结论：**是。当前基础框架已经足以支撑持续功能开发。**
- 依据：
  - Runtime 主链已具备 `workflow / run / node_run / run_events / waiting / resume / callback ticket / artifact`。
  - Publish 主链已具备 published endpoint、protocol mapping、API key、activity/export/access surface。
  - Editor 主链已具备 definition、runtime policy、publish draft、variables、validation navigator、tool capability guard。
  - Governance 主链已具备 sensitive access 分级、approval ticket、notification dispatch、operator inbox、bulk governance。
  - Compat 方向持续坚持 `7Flows IR` 优先，外部 Dify 插件经约束适配层进入内部模型，没有反向劫持内核设计。

## 架构判断

### 功能性开发

- 满足。当前不是 demo 架构，而是已有可持续补真的主干系统。
- 后续工作重点在闭环和一致性，不在重建内核。

### 插件扩展性与兼容性

- 满足继续推进的门槛，方向正确。
- 兼容层、catalog、execution planning 已逐步模块化；后续主要风险是 lifecycle / hydration 继续膨胀，而不是方向错误。

### 可靠性与稳定性

- 当前验证通过：
  - `api/.venv/Scripts/uv.exe run pytest -q` → `300 passed`
  - `web/pnpm exec tsc --noEmit` → 通过
- 说明主链已有真实回归保护，当前“可继续开发”的结论成立。

### 安全性

- 当前方向符合产品要求。
- 分级敏感访问、审批票据、通知通道、operator inbox、批量治理、published/run 详情聚合都已经是事实能力。
- 下一步不是推倒重做，而是继续补 policy explanation、审批后恢复与多入口一致性。

## 仍需持续治理的热点

- 后端热点：
  - `api/app/services/runtime_node_dispatch_support.py`
  - `api/app/services/agent_runtime.py`
  - `api/app/services/workspace_starter_templates.py`
  - `api/app/services/workflow_library_catalog.py`
  - `api/app/services/run_trace_views.py`
- 前端热点：
  - `web/components/workspace-starter-library/use-workspace-starter-library-state.ts`
  - `web/components/workflow-node-config-form/runtime-policy-form.tsx`
  - `web/components/workflow-editor-workbench/use-workflow-editor-graph.ts`
- 判断标准不是单看行数，而是看后续需求是否还会继续把 orchestration、validation、source governance、provider-specific 分支堆回单文件。

## 业务闭环判断

### 用户层

- 已有 workflow 编辑、发布、运行诊断、workspace starter、敏感访问治理等核心入口。
- 下一步要继续提升“等待原因、审批状态、恢复入口、失败解释”的可见性。

### AI 与人协作层

- 已有 `llm_agent`、waiting / resume、callback ticket、approval、timeline / evidence 主链。
- 下一步关键是把 AI 等待、人类批准或回调、系统恢复执行串成更完整的一条体验链。

### AI 治理层

- 已有敏感访问、审批、通知、审计和 published detail 的事实基础。
- 下一步关键是补政策解释、跨入口一致的治理摘要和 drilldown。

## 更新后的优先级判断

1. **P0：继续打通 waiting / resume / callback ticket 的端到端恢复闭环**
   - 这是 AI 与人协作真正进入可恢复执行的核心主链。
2. **P0：继续补齐 sensitive access 的治理解释与审批后恢复一致性**
   - 这是从“能用”升级到“可控、可审计、可商用治理”的关键。
3. **P0：继续补真 publish gateway / published invocation 的诊断与治理可见性**
   - 这是 OpenClaw-first 对外演示面是否真正可信的核心。
4. **P1：继续治理 backend service 与 frontend state hook 热点**
   - 目标是保障后续迭代速度，不让复杂度回流到单体模块。
5. **P1：继续提高 editor / starter 的字段级治理体验与 portability guard**
   - 目标是让复杂 workflow 定义能被持续维护，而不是越做越难改。

## 验证

- `api/.venv/Scripts/uv.exe run pytest -q`
  - `300 passed`
- `web/pnpm exec tsc --noEmit`
  - 通过

## 结论

- 当前项目已经具备可继续功能开发的基础框架，不需要回头重搭主骨架。
- 最近一次提交需要衔接，而且衔接方式应继续保持“拆热点、补闭环、守住 IR 与治理边界”。
- 当前还没有进入“只剩人工逐项界面设计”的阶段，因此不触发通知脚本。
