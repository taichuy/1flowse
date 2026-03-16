# 2026-03-16 项目现状复核与优先级衔接

## 背景

本轮按仓库约定重新复核了以下事实来源：

- `AGENTS.md`
- `docs/dev/user-preferences.md`
- `docs/product-design.md`
- `docs/technical-design-supplement.md`
- `docs/open-source-commercial-strategy.md`
- `docs/dev/runtime-foundation.md`
- `docs/history/` 最近一组开发留痕
- 最近一次 Git 提交与当前源码结构热点

这轮工作的目标不是另起一条新功能线，而是回答几个现实问题：

1. 上一轮提交做了什么，当前是否需要顺着衔接。
2. 基础框架是否已经足够支撑后续持续功能开发。
3. 当前架构是否基本满足扩展性、兼容性、可靠性、稳定性与安全性要求。
4. 是否存在明显过长、职责膨胀、应尽快继续解耦的热点文件。
5. 在现有产品设计目标下，下一轮开发应优先推进什么。

## 最近一次提交做了什么

当前 `HEAD` 为 `fd7d3bf refactor: split workflow editor workbench orchestration`。

这次提交集中做了三件事：

1. 把 `web/components/workflow-editor-workbench.tsx` 从约 545 行降到约 219 行。
2. 将 workflow editor 的 validation 聚合下沉到 `use-workflow-editor-validation.ts`。
3. 将 workflow / workspace starter 的保存与聚焦行为下沉到 `use-workflow-editor-persistence.ts`。

这不是孤立整理，而是直接承接 2026-03-16 当天围绕 workflow editor 的连续主线：

- node support status
- capability validation
- contract preflight
- validation issue category / path / field
- publish version preflight
- validation navigation / focus

结论：**需要继续衔接，而且衔接点很明确。**

当前更合理的继续方式，不是回头重搭 editor 或另起一套表单框架，而是顺着这次解耦后的边界继续治理：

1. `use-workflow-editor-graph.ts` 的 workflow-level mutation
2. node config / runtime policy / schema builder 的字段级聚焦
3. editor 与 sensitive access policy / publish portability 的更细粒度校验

## 是否已有可持续开发的基础框架

结论：**有，而且已经超过“初始化骨架”阶段。**

当前已形成的真实基础包括：

- 后端：
  - `runs / node_runs / run_events / run_artifacts / tool_call_records / ai_call_records` 事实层已成型
  - runtime 已支持 topology、branch、join、waiting / resume、callback ticket、artifact 与事件落库
  - published surface 已具备 native / OpenAI / Anthropic 三类入口与治理面基础
  - sensitive access 已进入真实审批 / 通知 / retry / diagnostics 主链
- 前端：
  - workflow editor 已从最小画布进入“可持续补真”的结构化阶段
  - run diagnostics、publish governance、workspace starter、sensitive access 已有真实工作台入口
  - editor 保存前快检、后端权威 preflight、字段级导航开始形成闭环
- 工程化：
  - `api/.venv + uv`、`pnpm`、Docker 本地 / 全容器双路径、`docs/history` 留痕机制都已建立

因此，当前项目不是“基础没写好，不能继续做功能”，而是“主干已经具备，下一步要持续控制复杂度并补关键闭环”。

## 当前架构是否基本满足后续要求

结论：**整体方向基本满足，但仍处于“可持续推进、尚未收官”的阶段。**

### 1. 功能性开发

- 满足。`workflow + runtime + trace + publish + governance` 主干已经成型。
- 当前继续补功能时，更多是在现有主链上加深，而不是在空地上重搭大框架。

### 2. 插件扩展性与兼容性

- 基本满足方向要求。
- 文档与代码都在坚持 `7Flows IR` 优先，没有把 Dify/OpenAI/Anthropic 协议直接写成内部主模型。
- compat adapter、tool gateway、published surface 已经有独立边界，但 Dify 插件兼容与 product-level skill retrieval 仍主要停留在“部分基础设施 + 明确目标设计”的阶段，尚未形成完整可用主链。

### 3. 应用可靠性与稳定性

- 已具备基础，但还没有到“稳定性工作基本结束”的程度。
- 强项：事件落库、waiting / callback ticket、published invocation 治理、sensitive access inbox / notification diagnostics 都在朝真实 operator 闭环推进。
- 仍需继续补强：`WAITING_CALLBACK` 的后台自动唤醒、callback / approval / published invocation 联合排障、run detail presenter 细化拆层。

### 4. 安全性

- 总体方向正确，且比早期更接近真实可控系统。
- 已有 credential store、sensitive access、tool execution capability guard、planned node fail-closed、sandbox_code 仍保持 planned / guarded 的诚实表达。
- 但独立的 `SandboxBackendRegistration / SandboxExecution` 仍未落地完成，当前不能把“execution-aware + subprocess opt-in”误写成正式沙箱产品能力。

## 需要继续解耦的热点文件

本轮结合源码行数与最近几轮开发记录，当前最值得继续关注的热点如下：

### 后端热点

- `api/app/services/workspace_starter_templates.py`
- `api/app/api/routes/workspace_starters.py`
- `api/app/services/runtime_node_dispatch_support.py`
- `api/app/services/run_views.py`
- `api/app/services/agent_runtime.py`
- `api/app/services/workflow_library_catalog.py`

这些文件不一定“已经坏掉”，但共同风险是：

- 同时承担 orchestration + presentation + validation + persistence 多类职责
- 容易在新需求进入时继续横向膨胀
- 测试与定位成本会逐轮上升

### 前端热点

- `web/components/workflow-editor-workbench/use-workflow-editor-graph.ts`
- `web/components/workflow-editor-publish-endpoint-card.tsx`
- `web/components/workspace-starter-library.tsx`
- `web/components/workflow-editor-variable-form.tsx`
- `web/lib/get-workflow-publish.ts`

其中最优先的仍然是 `use-workflow-editor-graph.ts`。

原因：

- 上一轮刚把 validation / persistence 从 workbench 壳层拆出
- graph hook 仍聚合 nodes / edges / variables / publish / selection / config JSON 多类状态与 mutation
- 如果不尽快继续拆，workflow editor 的复杂度会从壳层重新回流到 graph hook

## 是否可以继续推进产品完整度

结论：**可以，而且当前最应该做的是沿既有主线补完整度。**

当前已经具备以下面向产品设计目标的基础：

- 可编排：workflow definition、version、starter、editor skeleton
- 可调试：run detail、trace、execution、evidence、approval / notification timeline
- 可发布：published endpoint、API key、cache、protocol surface、invocation governance
- 可追溯：runs、node_runs、run_events、artifacts、tool / ai call records
- 可兼容：compat / tool gateway / published protocol mapping 已有骨架

真正还会限制产品完整度的，不是“有没有骨架”，而是以下闭环是否继续补齐：

1. graded execution 与 sandbox protocol 的真实分层落地
2. `WAITING_CALLBACK` 的 durable resume 主链
3. run diagnostics / publish governance / callback approval 的统一排障链路
4. workflow editor 在 structured form、schema builder、policy 配置上的持续补真
5. compat adapter、product skill retrieval、最小治理模型的后续收口

## 本轮优先级建议

### P0：继续推进执行与安全主链

1. 把 graded execution 从 execution-aware 扩成真实隔离能力
2. 把高风险路径的 fail-closed 继续落实到 capability / backend 语义
3. 继续收口 sandbox backend protocol 与 runtime adapter 边界

### P0：继续补齐 waiting / callback durable 语义

1. 完善后台自动唤醒与 scheduler 主链
2. 把 callback / approval / published invocation 的事实链路继续接通
3. 让 operator 排障入口更完整，不再在多个页面来回跳转猜状态

### P1：继续治理 workflow editor 热点

1. 拆 `web/components/workflow-editor-workbench/use-workflow-editor-graph.ts`
2. 继续把字段级聚焦从 publish / variables 扩到 node config / runtime policy / schema builder
3. 在现有 preflight 体系上补 sensitive access policy 与 starter portability 校验

## 本轮已落地动作

- 已按上面的 P1 优先级直接顺延上一轮 editor 解耦主线。
- 新增 `web/components/workflow-editor-workbench/use-workflow-editor-workflow-state.ts`，把 workflow-level 的 `variables` / `publish` state 与 mutation 从 `use-workflow-editor-graph.ts` 中拆出。
- `use-workflow-editor-graph.ts` 现继续回收到 graph orchestration 定位，主要聚焦 nodes / edges / selection / node config / edge mutation；`currentDefinition` 仍在这里统一组装，但 workflow-level mutation 已不再内联堆叠。
- 这说明当前项目需要的不是“回头重搭框架”，而是沿既有主线持续清理热点并补全业务闭环。

### P1：继续治理后端 presenter / route 热点

1. 继续拆 `run_views.py` / `run_trace_views.py` 的 presenter 边界
2. 继续收口 `workspace_starters.py` 与 `workspace_starter_templates.py` 的治理职责
3. 为 `agent_runtime.py` 的 provider-specific finalize / streaming / usage helper 继续预留细粒度扩展点

### P2：继续补兼容层与产品化边界

1. 收敛最小 `SkillDoc` 数据模型与 retrieval contract
2. 把 `organization / workspace / member / role / publish governance` 落成最小领域模型设计稿
3. 继续明确 Community License 的执行口径和产品边界

## 验证

本轮先完成现状复核，随后顺延上一轮 editor 主线，落了一次 focused 前端解耦。

完成的验证包括：

- 复核最近一次 Git 提交与 `docs/history/` 的连续性
- 扫描当前 `api/app`、`web/app`、`web/components`、`web/lib` 的源码行数热点
- 对 `runtime.py`、`agent_runtime.py`、`published_gateway.py`、`use-workflow-editor-graph.ts` 做定向抽查
- `web/pnpm lint`
- `web/pnpm exec tsc --noEmit`

## 结论

- 当前项目基础框架已经足够支撑持续功能开发，不需要回头重搭。
- 当前更像“主干已成型，热点需要持续治理”的阶段，而不是“只差 UI 润色”的阶段。
- 因此本轮不触发人工界面设计 / 验收通知脚本。
- 下一轮最有价值的入口，依然是沿 `runtime / waiting / editor hotspot / diagnostics` 四条主线继续补齐闭环，而不是横向扩散到新方向。
