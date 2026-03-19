# 2026-03-16 优先级评估与缺口复核

## 背景

- 用户要求重新阅读 `AGENTS.md`、`docs/dev/user-preferences.md`、`docs/product-design.md`、`docs/technical-design-supplement.md`、`docs/open-source-commercial-strategy.md` 与 `docs/dev/runtime-foundation.md`，结合当前代码和最近一次 Git 提交，按优先级重新回答：
  1. 当前架构是否已经满足后续功能开发、插件扩展、兼容性、可靠性、稳定性与安全性要求；
  2. 主要功能业务推进到了什么程度，用户层、AI 与人协作层、AI 治理层是否已经形成产品设计要求的闭环；
  3. 上一次 Git 提交做了什么、上一轮开发建议是否仍然成立；
  4. 当前是否存在已经明显过长、需要继续解耦分离的代码文件。
- 本轮目标不是新增功能，而是基于最新代码事实、验证结果和文档基线，刷新可继续开发的判断，并把优先级顺序与剩余缺口继续写回仓库事实索引。

## 复核范围

### 文档与策略基线

- `AGENTS.md`
- `docs/dev/user-preferences.md`
- `docs/product-design.md`
- `docs/technical-design-supplement.md`
- `docs/open-source-commercial-strategy.md`
- `docs/dev/runtime-foundation.md`
- `docs/history/2026-03-16-architecture-priority-refresh.md`

### Git 与结构热点

- `git log -5 --stat --oneline`
- `git show --stat --summary HEAD`
- `git status --short`
- `api/app/**/*.py` 与 `web/app|components|lib/**/*.ts(x)` 行数复核（排除 `.venv`、`node_modules`）

### 代码抽查

- 后端：`api/app/services/runtime.py`、`api/app/services/runtime_node_dispatch_support.py`、`api/app/services/workspace_starter_templates.py`
- 前端：`web/components/workflow-editor-workbench.tsx`、`web/lib/get-workflow-publish.ts`

## 验证

- `cd api; .\.venv\Scripts\uv.exe run pytest -q`
  - 结果：`300 passed in 40.25s`
- `cd web; pnpm exec tsc --noEmit`
  - 结果：通过
- `cd web; pnpm lint`
  - 结果：通过；仅保留 Next.js 关于 `next lint` 废弃的上游提示，无实际 lint 问题

## 评估结论

### 1. 架构是否满足继续开发与长期演进

- 结论：**满足继续功能开发与持续演进的门槛，不需要回头重搭主骨架。**
- 运行时主链已经稳定存在：`workflow definition/version -> compiled blueprint -> runtime -> run/node_run/run_events -> published surface -> diagnostics`。
- `api/app/services/runtime.py` 已维持 facade + mixin 组合形态，运行时主文件没有重新膨胀回万能 service；这说明当前架构可以继续承接功能开发，而不是被单文件结构阻断。
- `api/app/services/runtime_node_dispatch_support.py` 已把 execution-aware dispatch、tool/mcp/llm_agent 分发与 sensitive access waiting 收口在统一执行入口附近，说明“执行边界”和“业务节点语义”正在沿既有模型推进，而不是被外部协议牵着走。
- 插件兼容、发布协议、敏感访问与运行追溯都仍围绕 `7Flows IR`、`runs / node_runs / run_events`、published surfaces 和统一治理链演进，没有看到 Dify / OpenAI / Anthropic 协议反向主导内部模型的迹象。
- 安全治理已经进入真实主链，而不是只停留在文档层：credential、context、tool、trace export、published detail / export 的敏感访问控制都已经有统一落点。

### 2. 架构仍未完全闭合的关键风险

- 当前最大风险不是骨架缺失，而是 **高风险执行隔离能力仍未完全兑现为 capability-driven 的真实 backend 闭环**。
- 文档方向已经明确 `worker-first`、高风险路径 `fail-closed`、sandbox backend 独立于 compat adapter；代码侧也已有 execution-aware contract 与 `sandbox_code` availability gate，但距离真正的 `sandbox / microvm` backend registration、健康检查、强隔离执行兑现还有距离。
- `WAITING_CALLBACK` 虽然已经有 cleanup、resume、termination 边界，但 operator 视角的 callback drilldown、approval/callback 联合排障与跨入口解释仍不够完整。
- 前端 workflow editor、publish diagnostics 和治理视图已经成型，但字段级 explanation、敏感访问 explanation、publish/editor 的更细粒度交互完整度仍是下一阶段要补的真实缺口。

### 3. 业务闭环推进情况

#### 用户层

- 已具备首页工作台、workflow editor、publish panel、workspace starter、sensitive access inbox 等最小操作面。
- 这说明“用户能够创建、调试、发布、查看治理入口”的最小主链已经存在，不再是只有后端能力、没有前端承接。
- 但用户层还没有完全进入“只剩界面设计和人工逐项验收”的阶段，因此本轮 **不触发** 指定通知脚本。

#### AI 与人协作层

- 已具备 run detail、trace export、approval timeline、callback waiting lifecycle、published waiting surface 等共享事实入口。
- 这满足了“人和 AI 应看到同一条运行事实链”的方向要求，且与产品设计中“前端是摘要与排障入口、事实仍以 runs/node_runs/run_events 为准”的原则一致。
- 仍缺的主要是 operator explanation、callback/approval 联合排障说明，以及更清晰的 trace/publish drilldown 组织方式。

#### AI 治理层

- 已将 credential / context / tool / published detail / export access control 收进统一 sensitive access 主链。
- 这已经达到“治理能力进入产品主线”的状态，而不是继续散落在单点路由或前端禁用态。
- 当前缺口主要是更强的 operator 控制面、notification preset / target 策略、run/published detail 的统一 explanation，以及更完整的 Team/Enterprise 最小领域模型设计。

### 4. 上一次 Git 提交做了什么

- 本轮开始前，最新提交是 `bcdd469 docs: record architecture priority refresh`。
- 该提交没有新增业务代码，主要做了两件事：
  - 在 `docs/history/2026-03-16-architecture-priority-refresh.md` 记录“当前基础框架已足以继续推进，不需回头重搭”的判断；
  - 在 `docs/dev/runtime-foundation.md` 刷新当前判断与优先级，使主线继续聚焦 execution capability、waiting callback、sensitive access explanation、runtime/editor 热点拆分。
- 这说明上一轮开发建议仍然成立：**不是回头重写框架，而是沿 runtime / waiting / governance / editor 主线继续补闭环、拆热点。**

### 5. 哪些文件已经进入“应继续解耦”的区间

#### 后端热点

- `api/app/services/workspace_starter_templates.py`：约 `575` 行
- `api/app/services/runtime_node_dispatch_support.py`：约 `573` 行
- `api/app/services/agent_runtime.py`：约 `523` 行
- `api/app/services/workflow_library_catalog.py`：约 `484` 行
- `api/app/services/runtime_run_support.py`：约 `450` 行
- `api/app/services/sensitive_access_control.py`：约 `426` 行
- `api/app/services/notification_delivery.py`：约 `420` 行
- `api/app/services/run_callback_ticket_cleanup.py`：约 `415` 行
- `api/app/services/run_trace_views.py`：约 `405` 行

#### 前端热点

- `web/lib/get-workflow-publish.ts`：约 `457` 行
- `web/lib/workflow-tool-execution-validation.ts`：约 `399` 行
- `web/components/workflow-editor-variable-form.tsx`：约 `376` 行
- `web/components/workspace-starter-library/use-workspace-starter-library-state.ts`：约 `364` 行

#### 判断

- 这些长文件 **还没有阻断继续开发**，因为当前壳层拆分方向是有效的：
  - `web/components/workflow-editor-workbench.tsx` 已明显回到 orchestration shell；
  - route 与 facade 层大多已经从“主热点”退回“组合层”。
- 但它们已经进入“新增能力优先继续拆 helper / presenter / section / mutation hook，而不是继续叠加 if/branch”的区间。
- 当前最应该避免的是：把 waiting、publish diagnostics、tool execution capability、starter governance 或 variable schema 再直接堆回这些聚合文件。

## 优先级结论

1. **P0：把 graded execution 继续推进到真实隔离 backend 能力**
   - 优先补 sandbox backend registration / health / capability / fail-closed 主链，而不是只停留在 contract 和 host-side fallback。
2. **P0：继续收口 `WAITING_CALLBACK` 的 operator 恢复闭环**
   - 重点是 callback drilldown、approval/callback 联合排障与更完整的恢复解释。
3. **P0：继续补统一 sensitive access explanation 与跨入口 diagnostics**
   - 让 inbox、run detail、publish detail、trace export 的 operator 叙事继续对齐。
4. **P1：持续拆解 runtime / starter / editor / diagnostics 热点**
   - 继续盯住 `runtime_node_dispatch_support.py`、`agent_runtime.py`、`workspace_starter_templates.py`、`get-workflow-publish.ts` 和 editor hooks。
5. **P1：继续提高 workflow editor 与 publish governance 的字段级完整度**
   - 包括更细的 validation focus、schema builder、publish binding identity、starter portability 和 structured form 边界。
6. **P2：在主链更稳后，再推进 Skill Catalog 与 Team/Enterprise 领域模型**
   - 这两条方向成立，但当前仍不应抢占 runtime / waiting / governance 主优先级。

## 结论摘要

- 当前项目已经具备继续推进完整度和业务闭环的基础框架。
- 架构方向总体满足功能性开发、插件扩展性、兼容性、可靠性、稳定性与安全性继续演进的要求。
- 当前仍未到“只剩人工界面设计 / 人工逐项验收”的阶段，因此本轮不触发通知脚本。
- 最值得继续做的仍然是：沿 runtime / waiting / governance / editor 主线补闭环，并持续拆热点，防止复杂度回流。
