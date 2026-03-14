# 2026-03-15 项目现状复核与优先级衔接（执行分级后续）

## 背景

本轮先按仓库协作约定复核了以下事实来源：

- `AGENTS.md`
- `docs/dev/user-preferences.md`
- `docs/product-design.md`
- `docs/technical-design-supplement.md`
- `docs/dev/runtime-foundation.md`
- 最近 Git 提交、当前目录结构和关键后端/前端代码热点

目标不是重写产品方案，而是回答当前项目是否已经具备继续稳定推进的条件，并把最近一次提交之后最应该承接的事情按优先级收口。

## 本轮开发动作

### 1. 修复当前唯一前端全量 lint 阻塞

- 修改 `web/components/credential-store-panel.tsx`，把未转义的引号文案改为 `&quot;`，清除 `react/no-unescaped-entities` 报错。
- 该修改不改变业务语义，只是把现有前端全量 ESLint 从“失败”恢复到“可通过”。

### 2. 更新当前事实索引

- 重写 `docs/dev/runtime-foundation.md`，把 2026-03-15 的现状判断、验证结果、结构热点与下一步优先级同步到当前事实索引。
- 本文档继续维持“当前事实 + 热点 + 优先级”的角色，不再回退成流水账。

## 当前结论

### 1. 上一次 Git 提交做了什么，是否需要衔接

当前 `HEAD` 为 `153a20c feat: add runtime execution policy trace surface`。

这次提交主要完成了三件事：

1. 后端把 `runtimePolicy.execution` 接入 workflow schema 与 runtime input：
   - 新增 execution policy schema
   - 保护 `execution` 作为 runtime-managed input root
   - execution summary 可进入 run execution view
2. 前端 workflow editor inspector 增加 structured execution section：
   - 显示默认 execution class
   - 支持 override / profile / timeout / network / filesystem policy
   - 避免默认值无意义持久化
3. run diagnostics 展示 execution boundary：
   - 可以按 node run 查看 execution class / source / profile / timeout 等概要

结论：**需要继续衔接，而且衔接方向已经很明确。**

这次提交本质上是在承接上一个文档对齐提交 `65950d3 docs: align graded execution architecture guidance`，把“分级执行”从文档推进到 IR、编辑器和 trace 面。

但它还没有完成以下关键后续：

- Execution Adapter Registry
- tool / plugin 默认 execution class 映射
- `sandbox_code` 正式执行链
- Tool Gateway 内的 execution-aware dispatch

因此接下来不应切换到完全无关子线，而应优先把 execution policy 从“看得见”推进到“真正执行”。

### 2. 基础框架是否已经设计并写好

结论：**已经写到“可持续功能开发”的程度，而且主干架构方向是对的；但还没有到“核心闭环都完成，只剩界面设计”的程度。**

当前已经具备的基础包括：

- 后端基础：
  - FastAPI + Alembic + Celery 基础设施已落地
  - `runs / node_runs / run_events / run_artifacts / tool_call_records / ai_call_records` 已成型
  - `RuntimeService` 仍保持单一 orchestration owner
- runtime 主干：
  - compiled blueprint 执行链
  - branch / join / mapping / retry / waiting / resume / callback ticket
  - `llm_agent` 的 phase pipeline 与 artifact / evidence 分层
- 兼容与发布基础：
  - Dify compat adapter 的 registry / proxy / health / catalog 基础设施
  - native / OpenAI / Anthropic published surface
  - publish binding / API key / cache / invocation governance
- 前端骨架：
  - workflow editor workbench
  - structured runtime policy / contract / tool policy section
  - run diagnostics execution / evidence view
  - publish governance 与 plugin / credential 工作台入口

仍未达到产品设计目标的关键缺口主要是：

- 统一 Execution Adapter Registry 未落地
- `WAITING_CALLBACK` 的后台自动唤醒未闭环
- Loop durable runtime 未正式开放
- 统一 Sensitive Access Control 事实层与审批 / 通知闭环未落地
- Tool Gateway 还没真正承接 execution class 选择与敏感访问拦截

所以判断是：**框架已经不是问题，当前问题是关键治理能力和 durable runtime 还没完全闭环。**

### 3. 架构是否满足功能推进、插件扩展、兼容性、可靠性、稳定性和安全性

结论：**方向上基本满足，落地程度上是“可以继续推进，但仍有高优先级缺口”。**

#### 功能推进

满足度较高：

- 运行时、发布层、编辑器、诊断面板都已有真实代码路径，不再是空壳。
- 最近多轮提交已经证明项目可以持续在同一主线上累积，而不是每轮都推翻重来。

#### 插件扩展与兼容性

基础方向是对的：

- 当前兼容边界仍保持在 Dify plugin ecosystem adapter，而不是把 Dify ChatFlow DSL 搬进核心运行时。
- `plugin_runtime.py` 里 registry / compat adapter / catalog client / call proxy 已打通最小链路。
- 发布层仍从统一 runtime 结果映射到 native / OpenAI / Anthropic surface，没有分叉第二条执行链。

但还需要继续补：

- tool / plugin 执行类默认策略
- 插件脚本或高风险能力的 sandbox 路径
- plugin runtime 文件进一步拆层，降低 compat 侧继续增长时的维护成本

#### 可靠性与稳定性

现状比 2026-03-13 更好，但还没完全收口：

- backend `pytest` 219 个用例全部通过
- frontend `pnpm lint` 与 `pnpm exec tsc --noEmit` 通过
- runtime / publish gateway / diagnostics 已经过多轮热点拆分，主文件长度明显下降

剩余稳定性风险：

- backend 全量 `ruff check` 仍有 74 条历史问题，说明工程卫生还未完全达标
- `runs.py`、`plugin_runtime.py`、`workflow.py`、`workflow_library.py` 仍有集中化热点
- execution policy 现在更多是“配置与可观测性”能力，还没变成完整执行保障能力

#### 安全性

方向明确但落地不足：

- 上下文显式授权、artifact / evidence 分层、credential store、callback ticket 这些基础原语已经存在
- 但统一 Sensitive Access Control、审批票据、通知投递、Tool Gateway 拦截挂点仍未落地
- execution class 与 sensitivity_level 两条治理轴在文档中已经厘清，但代码中还没有真正形成闭环

因此整体判断是：**当前架构足够支持继续开发，不需要推翻重构；真正该做的是按优先级补 runtime governance 和安全闭环。**

### 4. 哪些代码文件仍偏长，适合继续解耦

按本轮复核时的 tracked source 行数，优先关注这些热点：

- 后端：
  - `api/app/schemas/workflow.py`：725 行
  - `api/app/services/workflow_library.py`：688 行
  - `api/app/services/plugin_runtime.py`：660 行
  - `api/app/services/agent_runtime_llm_support.py`：631 行
  - `api/app/api/routes/runs.py`：628 行
  - `api/app/services/published_protocol_streaming.py`：518 行
- 前端：
  - `web/components/run-diagnostics-execution-sections.tsx`：530 行
  - `web/components/workspace-starter-library.tsx`：440 行
  - `web/components/workflow-editor-workbench/use-workflow-editor-graph.ts`：403 行
  - `web/components/workflow-node-config-form/tool-node-config-form.tsx`：374 行

其中最值得优先继续拆的不是所有长文件，而是这几类“继续承载核心增长”的热点：

1. `plugin_runtime.py`
   - 因为它同时承担 registry、compat adapter、catalog client、health checker 与 call proxy
2. `workflow.py`
   - 因为它继续承担 IR schema + publish schema + 跨节点校验
3. `runs.py`
   - 因为 trace / export / run detail 聚在一起，继续扩展诊断时容易再膨胀
4. `run-diagnostics-execution-sections.tsx`
   - 因为 execution / evidence 详情层仍在持续增长
5. `published_protocol_streaming.py`
   - 因为 native / OpenAI / Anthropic SSE helper 仍在同一文件

### 5. 主要功能业务是否还能持续推进到产品目标

结论：**可以，而且现在比前两天更适合继续沿主线推进。**

原因：

- `7Flows IR` 仍是内部事实模型，当前实现没有被外部协议反客为主。
- runtime、publish、editor、diagnostics 四条主干都已经形成真实接口与真实 UI，而不是停留在单点 demo。
- 最近提交历史显示项目正在形成连续主线：runtime 治理 -> publish surface -> diagnostics -> execution policy surface。

当前最该避免的是：

- 重新设计第二套 runtime 抽象
- 为了 sandbox 或 compat 再造第二套节点语义
- 在统一敏感访问控制未落地前，直接把安全能力散落进各个业务点状逻辑

## 优先级建议

### P0：把 execution policy 从“可配置”推进到“可执行”

1. 落地 Execution Adapter Registry
2. 把 `runtimePolicy.execution` 接到真实 adapter dispatch
3. 为 `sandbox_code` 补正式执行链
4. 把 tool / plugin 默认 execution class 映射推进到 Tool Gateway

为什么是 P0：

- 这是最近一次提交之后最直接、最合理的延续
- 它同时影响运行时可靠性、插件扩展性和安全边界
- 如果这条线继续拖延，execution policy 会长期停留在“展示型功能”

### P0：补齐统一 Sensitive Access Control 闭环

1. 定义 `SensitiveAccessRequest` / `ApprovalTicket` / notification dispatch 事实层
2. 把拦截点挂到 Tool Gateway、credential resolve、context read、publish export
3. 让 waiting / resume 与审批恢复复用同一条 durable runtime 能力

为什么是 P0：

- 产品设计已经把它定义为初期关键事项
- 它直接关系到安全性与责任边界
- 后续插件执行、敏感资源访问和发布导出都依赖它

### P0：补齐 `WAITING_CALLBACK` 后台唤醒闭环

1. 把 callback ticket、scheduler、resume orchestration 真正串起来
2. 为后续审批恢复、timeout/fallback、通知回调复用这条能力

为什么是 P0：

- 这是 durable runtime 进入更稳定阶段的必要条件
- 没有它，waiting 仍偏人工 / 手动恢复导向

### P1：继续拆 compat / schema / diagnostics 热点

1. 拆 `plugin_runtime.py`
2. 拆 `workflow.py`
3. 拆 `runs.py`
4. 拆 `run-diagnostics-execution-sections.tsx`
5. 拆 `published_protocol_streaming.py`

为什么是 P1：

- 这些文件还没有阻断功能开发，但已经进入“继续加功能就会明显变脆”的区间
- 趁边界还清楚时拆分，成本比堆大后再拆更低

### P1：继续提高 editor 与 publish 完整度

1. workflow publish structured config
2. 敏感访问策略入口
3. 更清晰的 advanced JSON / structured form 边界
4. execution / evidence / artifact 视图与 editor overlay 的进一步联动

为什么是 P1：

- 这些会直接提升“可编排 + 可调试 + 可发布”的产品完成度
- 但优先级仍应低于 runtime governance 与安全闭环

## 验证

### Backend

在 `api/` 目录执行：

```powershell
.\.venv\Scripts\uv.exe run pytest
.\.venv\Scripts\uv.exe run ruff check
```

结果：

- `pytest`：通过，`219 passed`
- `ruff check`：失败，仍有 `74` 条历史风格/整理问题，说明后端全仓库静态卫生还未收口

### Frontend

在 `web/` 目录执行：

```powershell
pnpm lint
pnpm exec tsc --noEmit
```

结果：

- `pnpm lint`：通过
- `pnpm exec tsc --noEmit`：通过

## 结论

- 当前项目已经具备继续沿主业务主线推进的基础框架，不需要为“框架没写好”而回退重来。
- 最近一次提交已经把 execution policy 推到 IR / editor / trace 层，下一步最自然的承接就是 execution adapter registry 与真实执行链。
- 当前尚未达到“只剩人工逐项界面设计与验收”的阶段，因此本轮不运行通知脚本。
- 本轮同时把前端全量 lint 从阻塞状态修复为通过，并把最新现状和优先级同步回 `runtime-foundation`。
