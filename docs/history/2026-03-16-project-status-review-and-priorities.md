# 2026-03-16 项目现状复核与优先级判断

## 背景

- 用户要求基于仓库协作规则重新通读 `AGENTS.md`、产品/技术/策略基线、`docs/dev/runtime-foundation.md`、`docs/dev/user-preferences.md`，并结合最近 Git 提交与开发留痕，判断项目是否仍沿正确方向推进。
- 本轮重点不是重新发明架构，而是确认当前基础框架是否已经足够支撑持续功能开发、插件扩展、兼容演进、可靠性、安全性与后续业务闭环。

## 复核范围

- 文档基线：`AGENTS.md`、`docs/product-design.md`、`docs/technical-design-supplement.md`、`docs/open-source-commercial-strategy.md`、`docs/dev/runtime-foundation.md`、`docs/dev/user-preferences.md`
- 最近提交：`8128aff refactor: split run execution view builders` 及其前序几次 editor / starter 解耦提交
- 当前实现：`api/` runtime / publish / sensitive access / plugin compat / workflow definition 主链，`web/` editor / diagnostics / workspace starter / governance 主链
- 真实验证：后端 pytest、前端 TypeScript 类型检查

## 最近一次提交做了什么

- `8128aff refactor: split run execution view builders` 将 run detail / diagnostics 相关的 execution presenter 从 `api/app/services/run_views.py` 继续下沉到：
  - `api/app/services/run_execution_views.py`
  - `api/app/services/run_view_serializers.py`
- 配套更新了：
  - `api/app/services/published_endpoint_invocation_support.py`
  - `docs/dev/runtime-foundation.md`
  - `docs/history/2026-03-16-run-view-execution-decoupling.md`
- 这不是新方向切换，而是继续落实“热点单文件拆 helper、route/service/presenter 分层、让 diagnostics / publish / runtime 共用统一事实流”的既有路线。

## 是否需要衔接最近提交

- 需要，而且应该沿同一条主线继续衔接。
- 最近几次提交并不是零散修补，而是持续在做三件事：
  - 压缩热点单文件，避免 editor / diagnostics / starter / publish 重新长成单体。
  - 把 validation、governance、presenter、transport helper 从 route / 主 service 中剥离出去。
  - 让 workflow、workspace starter、published invocation、sensitive access 的行为逐步收口为同一事实模型和统一治理口径。
- 因此当前不应该回头怀疑“底座是否没搭好”，而应该继续把 waiting / resume、sensitive access、publish surface、editor persistence 这些已经开了头的主链补成闭环。

## 基础框架是否已写好

- 结论：**是，已经足够承接持续功能开发。**
- 主要依据：
  - runtime 已具备 `workflow / run / node_run / run_events / waiting / resume / callback ticket / artifact` 主链。
  - publish 已具备 published endpoint、protocol mapping、API key、alias path、async invocation、rate limit、cache、activity/export/access control。
  - editor 已具备 workflow definition、runtime policy、publish draft、variables、validation navigator、server/client capability guard。
  - governance 已具备 sensitive access 分级、approval ticket、notification dispatch、operator inbox、timeline、publish/run 聚合详情。
  - compat 方向已明确“外部生态通过 adapter 映射进 7Flows IR”，没有让外部协议反客为主。

## 架构是否满足后续扩展与稳定性要求

### 1. 功能性开发

- 满足。主干数据模型和 API 已经能支撑继续补业务闭环，而不是还停留在 demo 结构。
- 当前更像“已经有可运行骨架，需要持续收口一致性”，不是“需要重建执行内核”。

### 2. 插件扩展性与兼容性

- 基本满足，而且方向正确。
- 当前实现总体保持了：
  - 内部以 `7Flows IR` 为主；
  - Dify 插件兼容走 adapter / proxy / constrained IR；
  - sandbox backend 与 compat adapter 分层，不混成同一类对象。
- 风险不在于方向错误，而在于 compat lifecycle、catalog hydration、execution planning helper 仍有少数热点文件需要继续拆层。

### 3. 可靠性与稳定性

- 基本满足继续推进的门槛。
- 本轮真实验证结果：
  - `api/.venv/Scripts/uv.exe run pytest -q` → `300 passed`
  - `web/pnpm exec tsc --noEmit` → 通过
- 这说明当前主链并非只靠文档维持一致，已有较完整的回归保护。

### 4. 安全性

- 方向满足产品要求，而且已出现真实治理主链。
- 当前已有分级敏感访问、审批票据、通知通道、operator inbox、批量治理、timeline、publish/run 详情聚合；这符合“AI 与人协作时，敏感资源访问有审批和审计闭环”的设计要求。
- 仍需继续补的是 policy explanation、审批后恢复链路、更多 publish/run detail drilldown，而不是推倒重来。

## 是否存在明显架构风险

- 目前没有发现“必须停下来重构主骨架”的高危架构偏移。
- 但存在三类需要持续治理的中风险热点：
  1. **热点服务仍偏长**：例如 `api/app/services/workspace_starter_templates.py`、`api/app/services/runtime_node_dispatch_support.py`、`api/app/services/agent_runtime.py`、`api/app/services/workflow_library_catalog.py`。
  2. **前端治理入口仍偏集中**：例如 `web/components/workspace-starter-library.tsx` 仍承载较多 library / governance 交互。
  3. **主链闭环尚未全部打通**：waiting / resume / callback ticket、sensitive access 审批后恢复、publish detail 的治理解释仍需继续补齐。

## 哪些文件需要继续解耦

- 后端优先关注：
  - `api/app/services/workspace_starter_templates.py`
  - `api/app/services/runtime_node_dispatch_support.py`
  - `api/app/services/agent_runtime.py`
  - `api/app/services/workflow_library_catalog.py`
  - `api/app/services/run_trace_views.py`
- 前端优先关注：
  - `web/components/workspace-starter-library.tsx`
  - `web/components/workflow-editor-workbench/use-workflow-editor-graph.ts`
  - `web/components/workflow-node-config-form/runtime-policy-form.tsx`
- 判断标准不是“行数大就立刻拆”，而是后续新增 lifecycle、provider 分支、policy 解释、bulk governance 时，是否会继续把复杂度堆回单文件。

## 主要业务是否能继续推进闭环

- 结论：**能，而且现在应该继续围绕闭环推进，而不是停在局部能力堆叠。**

### 用户层

- 已具备 workflow 编辑、发布、运行诊断、workspace starter、publish activity、敏感访问治理等核心入口。
- 下一步重点是把更多失败原因、等待原因、审批状态、恢复入口解释得更清楚，让“可排障”真正对用户可见。

### AI 与人协作层

- 已具备 `llm_agent`、waiting / resume、callback ticket、sensitive access approval、timeline / evidence 主链。
- 下一步重点是把“AI 等待、人类批准/回调、系统恢复执行”的跨节点体验真正串成单一交互链路。

### AI 治理层

- 已具备敏感资源访问控制、审计、通知、published invocation export access 等基础能力。
- 下一步重点是补 policy explanation、governance drilldown、publish detail 中的治理视图一致性。

## 本轮判断后的开发优先级

1. **P0：waiting / resume / callback ticket 端到端闭环**
   - 这是连接 AI、人类与外部系统恢复链路的核心。
2. **P0：sensitive access 完整治理闭环**
   - 这是把“可用”提升到“可控、可审计、可商用治理”的核心。
3. **P0：publish gateway / published invocation 继续补真**
   - 这是 OpenClaw-first 对外切口是否真的可演示、可排障、可追溯的核心。
4. **P1：继续治理 compat plugin / workflow definition / diagnostics 热点文件**
   - 防止后续复杂度回流，保持功能推进速度。
5. **P1：继续提高 editor 与 starter 的字段级治理体验**
   - 让复杂工作流定义在前端真正可维护、可理解、可修正。

## 验证

- `api/.venv/Scripts/uv.exe run pytest -q`
  - `300 passed`
- `web/pnpm exec tsc --noEmit`
  - 通过

## 结论

- 当前项目已经不是“基础框架还没写好”的状态，而是“基础骨架已成立，接下来要围绕主链闭环持续推进”的状态。
- 最近提交需要衔接，而且应继续沿“拆热点、补闭环、守住 IR 与治理边界”的主线推进。
- 当前不触发人工界面设计通知脚本，因为项目还没进入“只剩人工逐项界面设计与验收”的阶段。
