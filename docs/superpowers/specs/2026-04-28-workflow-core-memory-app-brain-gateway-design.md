# Workflow Core、Memory App 与 Brain Gateway 设计稿

日期：2026-04-28

状态：设计已确认，待进入 `1+n` implementation plan

## 1. 文档目标

本文档用于沉淀 1flowbase 产品化路线的新共识：

1. 1flowbase 服务端不负责采集本地 Agent 会话；采集由另一个客户端或外部入口完成。
2. 1flowbase 服务端优先作为本地 Agent 可接入的大语言模型供应商、能力控制面和记忆工作流平台。
3. 记忆不做隐藏式默认注入，而是通过显式 Memory Node、显式变量引用和显式 MCP 工具调用进入运行链路。
4. Memory App 不单独发明一套特殊编排器，而是基于一个窄版 Workflow Core 构建。
5. 后续 implementation plan 采用 `1+n` 拆分：一个索引计划加多个独立子计划。

## 2. 当前判断

草稿中“coding agents 的共享大脑与审计控制台”方向成立，但落地顺序需要调整。

当前更高胜率的路线不是先做外部 session 采集，也不是继续扩张成全量 Dify / n8n 式编排器，而是先把 1flowbase 打造成：

```text
本地 Agent 可配置的大语言模型供应商
+ Brain Gateway
+ Workflow Core
+ Memory App
+ Application-scoped MCP
+ Runtime fact / usage / billing / audit
```

其中：

- 本地 Agent 通过 OpenAI-compatible / Anthropic-compatible 等协议把 1flowbase 当作模型入口。
- 1flowbase 内部可以把请求路由到上游大语言模型、容灾队列或一个 Brain AgentFlow。
- 记忆能力由 Memory App 暴露，调用方显式选择是否使用。
- MCP 是能力暴露面，不是内部唯一建模方式。
- 运行事实、账本、上下文投影和审计仍沿当前 runtime observability 主线推进。

## 3. 已确认产品边界

### 3.1 不做服务端采集

服务端本阶段不做：

- 不主动抓取 Claude Code / Codex / OpenCode / OpenClaw 的本地会话。
- 不监听本地 shell、文件系统、浏览器或 MCP 行为。
- 不把外部 Agent 自述日志当作主审计事实。

这些动作由外部客户端、sidecar 或后续 bridge 负责。服务端只记录自己实际观测和执行的事实。

### 3.2 作为大语言模型供应商

1flowbase 服务端对本地 Agent 的第一身份是模型供应商入口：

```text
Local Agent
  -> 1flowbase model endpoint
  -> Brain Gateway
  -> route policy
  -> upstream model / failover queue / Brain AgentFlow
```

Brain Gateway 负责：

- 协议入口；
- route 解析；
- provider / relay / failover 选择；
- usage / cost / credit / billing session；
- RuntimeEvent / RuntimeSpan / RuntimeItem；
- ContextProjection 证明；
- trust level 标记。

Brain Gateway 不默认注入记忆，不默认改写用户消息。

### 3.3 记忆显式使用

记忆能力必须显式进入工作流：

1. 在 agentFlow 中放置 Memory Node。
2. Memory Node 绑定一个 Memory App 和 connector。
3. Memory Node 运行后产生变量。
4. 后续 LLM 节点用模板变量引用这些输出。

示例：

```text
[Start]
   |
   v
[Memory Retrieve]
   outputs.memory_context
   outputs.records
   outputs.citations
   |
   v
[LLM]
   system:
   {{node-memory.memory_context}}
```

不支持 prompt 中引用 memory 变量时懒触发检索。运行链路必须显式、可审计、可复盘。

## 4. Application 类型

当前建议把应用类型扩展为三类主线：

| Application Type | 定位 | 输出形态 |
| --- | --- | --- |
| `agent_flow` | 已有大语言模型编排应用 | 可流式调试、对话运行、节点级 trace |
| `workflow` | 新增通用结构化工作流应用 | 一次请求进，一次结构化 JSON 出 |
| `memory` | 基于 Workflow Core 的记忆应用 | connector 化的记忆读写与检索能力 |

`memory` 不是完全独立运行时，而是 workflow-specialized app：

- 有默认 connectors；
- 有默认 workflow 模板；
- 有默认 memory tables；
- 有默认 App MCP surface；
- 允许用户改 workflow、改表、改插件适配。

## 5. Workflow Core

### 5.1 定位

Workflow Core 复刻 Dify Workflow 的核心心智：可配置执行图。

但第一版不复刻 Dify 的全量产品，不做 Chatflow / Workflow 双形态，不做大语言模型流式回答 UI。

第一版 Workflow Core 是结构化工作流：

```text
Input -> nodes -> Return(JSON)
```

它适合：

- Memory App；
- 数据同步；
- 文件处理；
- 插件任务；
- 系统自动化；
- 后续非流式业务编排。

### 5.2 与 agentFlow 的边界

agentFlow：

- 面向大语言模型编排；
- 有 LLM 节点、prompt、模型选择、streaming；
- 有 Debug Console；
- 有对话结果与节点 Last Run；
- 后续可对外发布成模型或应用入口。

Workflow Core：

- 面向结构化请求和结构化响应；
- 默认不做 token streaming；
- 默认不做对话态；
- 节点结果进入结构化 output；
- 可被 Application connector、MCP tool、agentFlow node 调用。

### 5.3 第一版节点集合

Workflow Core 第一版建议只保留必要节点：

| Node | 用途 |
| --- | --- |
| `Start` | 定义 connector input schema |
| `Table Query` | 查询平台 runtime table 或 memory table |
| `Table Insert` | 写入记录 |
| `Table Update` | 更新记录 |
| `Template / Transform` | 格式化、字段映射、上下文拼接 |
| `If Else` | 条件分支 |
| `Return` | 返回结构化 JSON |

后续再扩展：

- `HTTP Request`
- `Plugin Call`
- `LLM`
- `MCP Call`
- `Sub-workflow`
- `Approval`

## 6. Memory App

### 6.1 定位

Memory App 是一个特殊化的 workflow application，用于定义团队 workspace 内共享记忆的存储、检索和变更方式。

Memory App 的核心不是“自动把记忆塞进 prompt”，而是提供可配置、可审计、可替换的记忆 connector。

### 6.2 Connector-first 模型

Memory App 采用 connector-first 模型：

```text
Memory App
  Connectors
    retrieve
    store
    mutate
    delete/archive
  Workflows
    retrieve workflow
    store workflow
    mutate workflow
  Memory Tables
    default tables / custom tables
  App MCP Surface
    tools generated from connectors
```

connector 是入口合同，workflow 是实现方式。

调用方只依赖 connector：

```text
memory_app.retrieve(input) -> output
memory_app.store(input) -> output
memory_app.mutate(input) -> output
memory_app.delete(input) -> output
```

调用方不关心内部使用默认表、自定义表、外部插件还是外部记忆系统。

### 6.3 不再设计 trigger 维度

Memory App 不单独设计 `trigger` workflow。

原因：

- 外部请求；
- MCP 调用；
- 手动测试；
- 定时任务；
- agentFlow 节点触发；

这些本质都是调用来源，不是 Memory App 的业务分支。

Memory App 内部只关心 connector 请求：

```text
source -> connector -> workflow -> structured output
```

### 6.4 默认 connectors

第一版默认提供：

| Connector | 输入 | 输出 |
| --- | --- | --- |
| `retrieve` | query、scope、limit、filters | memory_context、records、citations、metadata |
| `store` | content、source、tags、scope、metadata | record_id、record、status |
| `mutate` | record_id 或 query、patch、operation | record、changed_fields、status |
| `delete/archive` | record_id、reason | status、record_id |

其中 `delete/archive` 可以在第一版实现计划中拆到后置任务，但 connector 合同应先预留。

### 6.5 默认记忆类型

默认模板参考 `.memory` 的协作记忆分类：

| Memory Type | 用途 |
| --- | --- |
| `user_preference` | 用户偏好、协作习惯、沟通风格 |
| `project_fact` | 当前项目阶段事实、短期共识 |
| `decision` | 架构决策、产品决策、取舍原因 |
| `feedback_rule` | 用户纠正、确认过的执行规则 |
| `tool_lesson` | 工具失败案例与已验证解法 |
| `task_note` | 临时待办、未闭环事项 |

默认表结构应足够通用，但不阻止用户通过数据建模定义替换或扩展。

### 6.6 Memory App Runtime Variables

Memory App 不直接注入 prompt。它通过 Memory Node 输出变量。

建议标准输出：

```text
memory_context
records
citations
metadata
```

可选派生输出：

```text
memory_user_preferences
memory_project_facts
memory_decisions
memory_tool_lessons
```

这些变量由显式 Memory Node 运行后进入 VariablePool。

## 7. Memory Node

### 7.1 agentFlow 中的 Memory Node

agentFlow 增加 Memory Node：

```text
Memory Node
  config:
    memory_app_id
    connector: retrieve | store | mutate | delete/archive
    input_bindings
    output_schema_snapshot
```

Memory Node 调用 Memory App connector workflow，产出结构化 outputs。

### 7.2 LLM 节点消费方式

LLM 节点不自动消费 Memory App。

用户有两种显式方式：

1. 使用 Memory Node 输出变量：

```text
{{node-memory.memory_context}}
```

2. 在 LLM 节点挂载 Memory App MCP tools，让模型可主动 tool call。

第一阶段优先实现第 1 种，第二阶段再实现第 2 种。

### 7.3 运行时要求

Memory Node 运行必须产生：

- node run；
- RuntimeSpan；
- RuntimeEvent；
- connector invocation record；
- input snapshot；
- output snapshot；
- memory records / citations 引用；
- error payload；
- usage 或成本信息，如内部调用模型或外部插件。

## 8. MCP 设计

### 8.1 MCP 是暴露面

MCP 是让外部 Agent 或 LLM 节点发现和调用能力的协议面，不是 Memory App 的内部唯一建模。

Memory App 的内部真相仍是：

```text
connector contract + workflow implementation + table/plugin backend
```

### 8.2 系统级 MCP

系统级 MCP 面向 root/admin/system agent。

它可以暴露系统管理能力，例如：

- 管理模型供应商；
- 管理 applications；
- 管理 memory templates；
- 管理 workflow；
- 管理权限和审计；
- 查询系统运行状态。

系统级 MCP 不默认暴露给普通应用，也不默认挂载到 LLM 节点。

### 8.3 应用级 MCP

每个 Application 都应独立暴露自己的 App MCP surface。

Memory App 可暴露：

```text
memory.retrieve
memory.store
memory.mutate
memory.delete
```

tool id 必须包含 app scope，避免跨应用混权：

```text
app_mcp:memory:{memory_app_id}:retrieve@v1
app_mcp:memory:{memory_app_id}:store@v1
app_mcp:memory:{memory_app_id}:mutate@v1
```

### 8.4 渐进式 MCP

MCP 加载采用三阶段：

```text
Discover
  只加载 server/app/connector 轻量索引

Retrieve
  按当前节点、权限、workspace 和 app scope 解析可用 tool schema

Use
  模型发起 tool_call 或外部 MCP client 调用时，才执行 connector workflow
```

目标是避免 MCP 和 memory 成为默认 token 税。

## 9. 权限与隔离

本设计按团队 workspace 共享记忆和权限来做。

### 9.1 权限模型

Memory App 继承 Application 权限心智：

- 谁可以查看 Memory App；
- 谁可以调用 retrieve；
- 谁可以调用 store；
- 谁可以 mutate；
- 谁可以 delete/archive；
- 谁可以编辑 Memory Workflow；
- 谁可以管理 App MCP 暴露；
- 谁可以把 Memory App 挂载到 agentFlow。

### 9.2 应用隔离

每个 Application 必须隔离：

- connector；
- workflow；
- table scope；
- MCP surface；
- runtime records；
- audit events；
- secrets；
- plugin permissions。

agentFlow 引用 Memory App 时必须经过显式授权。

### 9.3 记忆作用域

默认作用域建议：

| Scope | 含义 |
| --- | --- |
| `workspace` | 团队共享记忆 |
| `application` | 某个 Memory App 私有或主控记忆 |
| `user` | 用户个人可见记忆 |
| `session` | 单次会话临时记忆 |

当前 `07 数据建模、作用域与 Runtime CRUD` 已固定 `workspace/system` 作用域。实现计划需要评估 application/user/session 是作为 memory 记录字段表达，还是扩展 runtime scope 语义；在代码未确认前，不把它们假定为已经存在的主存储 scope。

## 10. Brain Gateway

### 10.1 对本地 Agent 的入口

本地 Agent 接入 1flowbase 时，主要通过模型协议入口：

```text
Local Agent -> OpenAI-compatible endpoint -> Brain Gateway
```

Brain Gateway 可以根据 route 选择：

- 直接转发上游模型；
- 使用固定 provider instance；
- 使用 LLM 节点 failover queue；
- 调用某个 Brain AgentFlow；
- 后续调用 workflow 或 memory connector。

### 10.2 不默认记忆注入

Brain Gateway 默认不检索 Memory App，不自动插入 recall pack。

如果需要记忆参与，有两种显式方式：

1. route 到一个 Brain AgentFlow，由 agentFlow 内部显式使用 Memory Node。
2. 外部 Agent 通过 App MCP 显式调用 Memory App connector。

这样可以保证：

- token 成本可解释；
- prompt cache 风险可控；
- 调试台能看到记忆从哪里来；
- 审计链不混入隐藏上下文。

## 11. 运行审计

Memory App、Workflow Core、App MCP 和 Brain Gateway 都必须接入 runtime fact 主线。

关键事实包括：

- connector invocation；
- workflow run；
- workflow node run；
- memory table read/write；
- MCP discover/retrieve/use；
- Memory Node output；
- LLM prompt 中是否引用 memory variable；
- ContextProjection；
- token / cache / cost；
- trust level；
- audit hash。

调试目标不是只告诉用户“用了记忆”，而是能回答：

```text
这次运行调用了哪个 Memory App？
调用了哪个 connector？
执行了哪条 workflow？
读写了哪些记录？
返回了哪些 memory_context？
LLM 最终是否真的引用了这些变量？
最终发给模型的输入 hash 是什么？
```

## 12. UI 信息架构

### 12.1 Memory App 页面

Memory App 详情建议固定分区：

```text
Memory App
  Connectors
  Workflows
  Tables
  MCP
  Logs
  Permissions
```

第一版可以先收敛为：

- `Workflows`
- `Tables`
- `MCP`
- `Logs`

### 12.2 Workflow Editor

Workflow Editor 可以复用 agentFlow 的画布基础能力，但必须保持产品边界：

- 不出现 LLM streaming 调试台；
- 不展示对话式运行；
- 运行结果是结构化 JSON；
- 调试面板以 input/output、node trace、table diff 为主。

### 12.3 agentFlow 中的 Memory Node

Memory Node 配置区：

```text
Memory App      [选择应用]
Connector       [retrieve]
Inputs
  query         {{node-start.query}}
  limit         8
Outputs
  memory_context
  records
  citations
```

LLM 节点上下文消息中由用户手动插入：

```text
{{node-memory.memory_context}}
```

如果 LLM 节点挂载了 Memory App MCP 但没有在 prompt 中引用 Memory Node 变量，不提示错误；这是两种不同使用方式。

## 13. 实施顺序建议

后续 implementation plan 按 `1+n` 拆分。

### 13.1 Plan Index

索引计划负责锁定：

- 全局边界；
- 依赖顺序；
- 验收矩阵；
- 与现有 agentFlow/runtime/plugin/model provider 的兼容边界；
- 每个子计划的交付口径。

### 13.2 子计划建议

建议拆为：

1. Workflow Core domain and runtime
2. Workflow Editor minimum UI
3. Memory App domain, connector contract, default templates
4. Memory tables and data modeling integration
5. Memory Node in agentFlow
6. Application-scoped MCP surface
7. Brain Gateway route integration
8. Runtime audit, ContextProjection, debug read model
9. Permissions, workspace sharing, QA hardening

其中第一阶段最小闭环应是：

```text
Workflow Core
  -> Memory App retrieve/store/mutate connectors
  -> Memory Node
  -> LLM prompt variable reference
  -> runtime audit
```

App MCP 和 Brain Gateway 可以作为后续子计划推进。

## 14. 非目标

本阶段不做：

1. 服务端采集本地 Agent 会话。
2. 默认记忆注入。
3. prompt 引用 memory 变量时懒触发检索。
4. 完整复刻 Dify 的 Chatflow / Workflow 双产品。
5. Workflow Core 第一版 token streaming。
6. 外部 Agent 自述日志进入主审计链。
7. 无权限隔离的全局 MCP tools。
8. 一次性完成所有外部记忆系统插件。

## 15. 设计自检

### 15.1 与已确认讨论一致

- 不做服务端采集：已收口。
- 作为本地 Agent 的模型供应商：已收口。
- Memory App 显式使用：已收口。
- 不默认注入：已收口。
- 每个应用隔离：已收口。
- 团队 workspace 共享记忆和权限：已收口。
- 多个 connector 提供默认构建工作流：已收口。
- Memory App 变量必须由显式 Memory Node 运行产生：已收口。
- 后续 plan 采用 `1+n`：已收口。

### 15.2 与当前代码事实兼容

- `Application` 已是一级对象，可扩展 application type。
- `agentFlow` 已有 LLM 节点、prompt messages、VariablePool 心智和 Debug Console。
- `07 数据建模、作用域与 Runtime CRUD` 可作为 memory table 基础，但 memory-specific scope 需要实现计划再定。
- runtime observability 已有 `RuntimeSpan / RuntimeEvent / RuntimeItem / ContextProjection / ledger` 基础。
- provider / model gateway / billing / failover 已在当前代码中形成基础，不需要从零开始。

### 15.3 范围控制

本 spec 只锁定产品与架构设计，不拆具体任务、不新增代码、不决定数据库 migration 细节。

