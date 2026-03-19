# 2026-03-16 项目现状复核与 execution override 衔接

## 背景

本轮按仓库协作约定重新复核了以下事实来源：

- `AGENTS.md`
- `docs/dev/user-preferences.md`
- `docs/product-design.md`
- `docs/open-source-commercial-strategy.md`
- `docs/technical-design-supplement.md`
- `docs/dev/runtime-foundation.md`
- 最近 Git 提交、关键后端/前端结构热点与测试现状

目标不是重写产品方案，而是回答当前项目是否已经具备继续稳定推进的条件、最近一次提交是否需要继续衔接，以及本轮应该沿哪个优先级继续推进。

## 本轮开发动作

### 1. 复核最近提交与当前主线

当前 `HEAD` 为 `c74c20a feat: add sensitive access notification worker`。

这次提交已经把统一敏感访问控制补到了更真实的异步通知主链：

- 新增 `NotificationDispatchScheduler`，通过 transaction-aware 的 `after_commit` 调度派发 worker。
- 新增 `NotificationDeliveryService` 与 `notifications.deliver_dispatch` Celery task。
- 让 `NotificationDispatchRecord` 不再停留在“创建时直接写死 delivered/failed”的占位语义。

结论：**需要继续衔接，但方向已经从“有没有通知 worker”收口为“继续补真实 adapter、批量治理动作和 operator 解释层”。** 这次提交本身没有偏离产品边界，反而证明统一敏感访问控制这条主线已经足够稳定，可以继续向外扩。

### 2. 修复 agent 内 tool call 级 execution override 丢失

复核 execution policy 主线时发现一个会直接影响功能真实性的问题：

- `AgentToolCall.execution` 在运行时是一个直接 payload（例如 `{ class, profile, timeoutMs }`）。
- 但 `resolve_tool_execution_policy()` 之前只识别“完整 `toolCall` 对象里的 `execution` 字段”，没有识别直接 payload 形态。
- 结果是 `mockPlan.toolCalls[].execution` 会被静默忽略，运行态退回到 `toolPolicy.execution` 或默认值，导致 per-call 级 execution override 虽然能写进定义，却不能真实驱动 trace / artifact / event。

本轮修改：

- 更新 `api/app/services/runtime_execution_policy.py`，让 `resolve_tool_execution_policy()` 同时支持两种输入形态：
  - 完整 `toolCall` 对象
  - 直接 execution payload
- 新增回归测试 `test_llm_agent_tool_call_execution_override_wins_over_tool_policy()`，验证 tool call 级 execution override 优先于 `toolPolicy.execution`，并且事件与 artifact 元数据都反映 `tool_call` 作为来源。

### 3. 同步当前事实索引

- 更新 `docs/dev/runtime-foundation.md`，把本轮对 execution override 的修复沉淀到“当前判断”和“下一步规划”。
- 继续维持 `runtime-foundation.md` 只记录当前事实、热点与优先级，不把它写回流水账。

## 当前结论

### 1. 上一次 Git 提交做了什么，是否需要衔接

**做了什么：**

- 把敏感访问的通知投递从 request path 内同步占位，推进成 transaction-aware scheduler + worker + adapter 的 durable 语义。
- 补上了与 Celery include、scheduler、测试和文档同步相关的一整轮闭环。

**是否需要衔接：需要，但不是推翻重来。**

优先承接方向：

1. 真实 `email / slack / feishu` adapter 与 delivery contract。
2. inbox / run / published detail 的批量治理动作与统一 security explanation。
3. 继续把 execution policy 从“看得见”推进成“隔离真实生效”。

### 2. 基础框架是否已经设计并写好

结论：**已经写到“可以持续做功能开发”的程度，而且主干方向是对的。**

理由：

- 后端已经有稳定的事实层：`runs / node_runs / run_events / run_artifacts / tool_call_records / ai_call_records`。
- `RuntimeService` 仍保持唯一 orchestration owner，没有让 sandbox、compat adapter 或子执行器反客为主。
- runtime 主干已经具备 compiled blueprint、branch / join、waiting / resume、callback ticket、artifact/evidence 分层。
- 发布层与兼容层已经是“真接口 + 真网关 + 真健康检查”，不是停留在文档壳子。
- 前端工作台、workflow editor、run diagnostics、sensitive access inbox 都已有真实页面与真实数据链路。

但它**还没有**到“只剩人工逐项界面设计/验收”的阶段，所以本轮不触发 `node "e:\code\taichuCode\ai-presson-wen\aionui\notice\kill-port-8050.js"` 通知脚本。

### 3. 架构是否满足功能推进、插件扩展、兼容性、可靠性、稳定性和安全性

#### 功能推进

满足度较高：

- `RuntimeExecutionAdapterRegistry` 已进入 runtime 主链，execution policy 不再只是表单字段。
- `SensitiveAccessRequest / ApprovalTicket / NotificationDispatch` 已成为统一事实层，而不是点状 if/else。
- workflow editor、publish draft、run diagnostics、operator inbox 都已能继续往同一主线叠加功能。

#### 插件扩展与兼容性

方向正确，但仍需继续补真实隔离：

- 当前兼容边界仍维持在 Dify plugin ecosystem adapter，没有把外部 DSL 反向灌进 `7Flows IR`。
- 但 compat tool 仍主要通过 adapter service / subprocess 桥接，真实 `sandbox / microvm` tool adapter 还没落地。
- 因此扩展性成立，**隔离级别的兑现还没完全成立**。

#### 可靠性与稳定性

已经进入“可持续演进”阶段：

- 最近多轮提交都能保持同一主线累积，而不是频繁推翻重写。
- 后端 execution policy、sensitive access、callback waiting 都有成体系测试覆盖。
- 本轮新增回归测试后，tool call 级 execution override 也不再有“配置可写、运行不生效”的隐性漂移。

剩余风险：

- `ToolGateway` 的 execution trace 已到位，但真实执行边界仍有 fallback。
- `run_views.py`、`agent_runtime_llm_support.py`、`use-workflow-editor-graph.ts` 等热点继续增长时，维护成本会上升。
- `email` adapter 仍是诚实失败，不是实际投递能力。

#### 安全性

方向明确，而且主线已经落地：

- 节点间显式授权、artifact/evidence 分层、credential masked handle、sensitive access approval/notification 已经形成统一闭环雏形。
- 统一敏感访问控制已经接到 credential resolve、context read、tool invoke、trace export 和 published detail。

剩余缺口：

- operator 批量治理动作不够完整。
- 更多通知通道的真实 adapter 还未接上。
- execution class 与真实宿主隔离的对应关系还需要继续做实。

### 4. 哪些代码文件仍偏长，适合继续解耦

当前最值得继续拆的不是所有长文件，而是这些“还在承载主线增长”的热点：

1. `api/app/services/agent_runtime_llm_support.py`
   - 约 636 行，已经承担 phase-specific LLM helper 与较多 agent 侧细节。
2. `api/app/services/workspace_starter_templates.py`
   - 约 610 行，模板衍生、同步和持久化规则继续增长时容易再变脆。
3. `api/app/services/runtime_node_dispatch_support.py`
   - 约 608 行，虽然已经按 mixin 拆层，但 node dispatch 仍是 runtime 主链增长点。
4. `api/app/api/routes/workspace_starters.py`
   - 约 608 行，路由内仍承载较多变体入口，适合继续下沉 presenter / helper。
5. `api/app/services/run_views.py`
   - 约 568 行，run detail / diagnostics presenter 仍容易继续膨胀。
6. `web/lib/get-workflow-publish.ts`
   - 约 500 行，前端 publish surface 类型与 fetch helper 可继续模块化。
7. `web/components/workflow-editor-workbench/use-workflow-editor-graph.ts`
   - 约 466 行，画布状态与交互逻辑继续增长前建议先拆 hook/helper。
8. `web/components/workspace-starter-library.tsx`
   - 约 441 行，列表、对话框、批量动作与错误态可继续拆层。
9. `web/components/workflow-editor-publish-endpoint-card.tsx`
   - 约 418 行，发布配置与状态展示可以继续拆 presenter / form block。
10. `web/components/sensitive-access-timeline-entry-list.tsx`
    - 约 410 行，已经是共享安全时间线入口，后续一加批量动作就会继续长。

### 5. 主要功能业务是否还能持续推进到产品目标

结论：**可以，而且当前比“重新设计一轮”更适合继续沿主线推进。**

原因：

- `7Flows IR` 仍是内部事实模型，没有被 OpenAI / Anthropic / Dify / OpenClaw 协议反客为主。
- runtime、publish、diagnostics、editor、sensitive access 都已经形成真实链路，适合继续“补闭环”而不是重造骨架。
- 最近提交链条具备连续性：execution policy surface -> callback durable resume -> sensitive access timeline -> notification worker -> 本轮 per-call execution override 修复。

## 优先级建议

### P0：继续把 graded execution 从 execution-aware 扩成真实隔离能力

1. 为工具调用补真实 `sandbox / microvm` adapter，而不只是在 trace 中回落成 `inline/subprocess`。
2. 把 compat plugin execution boundary 明确接到 execution adapter 层，而不是继续隐含在 adapter service 桥接里。
3. 继续补 execution summary 聚合与 operator 可见性。

为什么仍是 P0：

- execution policy 已经进入 schema、editor、runtime、artifact 和 trace；越往后拖，越容易形成“配置越来越多，但宿主隔离始终没兑现”的结构性债务。

### P0：继续扩统一 Sensitive Access Control 闭环

1. 补 `email / slack / feishu` 的真实 adapter 与配置约定。
2. 补 inbox / run / published detail 的批量 approve/reject/retry。
3. 补统一 security explanation，减少 operator 排障时的上下文跳转成本。

为什么仍是 P0：

- 统一敏感访问控制已经不再只是文档设计，而是 runtime 真主链；越早补齐真实 adapter 和 operator 面，越能避免安全治理再次退回点状实现。

### P0：继续收口 `WAITING_CALLBACK` 的 durable resume 语义

1. 补 published callback drilldown。
2. 补 callback/approval 联合排障解释。
3. 继续把 callback 型节点的 operator 控制入口集中化。

为什么仍是 P0：

- callback 现在已经有停机边界，但 operator 侧排障和治理入口仍偏分散，继续补齐收益很高。

### P1：继续治理结构热点

1. `agent_runtime_llm_support.py`
2. `runtime_node_dispatch_support.py`
3. `run_views.py`
4. `get-workflow-publish.ts`
5. `use-workflow-editor-graph.ts`

为什么是 P1：

- 它们还没有阻断功能，但已经进入“继续堆功能就会明显变脆”的区间；趁边界清楚时拆，比后面再拆便宜。

## 验证

在 `api/` 目录执行：

```powershell
.\.venv\Scripts\uv.exe run pytest tests/test_runtime_service_agent_runtime.py -q
.\.venv\Scripts\uv.exe run pytest tests/test_runtime_service.py -q
.\.venv\Scripts\uv.exe run ruff check app/services/runtime_execution_policy.py tests/test_runtime_service_agent_runtime.py
```

结果：

- `tests/test_runtime_service_agent_runtime.py -q`：`9 passed`
- `tests/test_runtime_service.py -q`：`21 passed`
- `ruff check`：通过

## 结论

本轮结论是：**项目基础框架已经足够支撑持续功能开发，最近提交也需要衔接，但下一步不该乱切子线。**

- 上一轮 notification worker 证明统一敏感访问控制这条主线已经可持续推进。
- 本轮 execution override 修复说明 runtime execution policy 仍有值得尽快收口的细节债，但这些债属于“沿主线补真”，不是“架构方向错了”。
- 当前最应该避免的是：
  - 为了隔离再造第二套 runtime 语义
  - 为了兼容再让外部协议反向主导内部模型
  - 因为前端入口越来越多，就把安全/执行策略重新散落回各业务点
