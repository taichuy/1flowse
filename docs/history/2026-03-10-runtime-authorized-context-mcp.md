# Runtime Authorized Context And MCP Query

## Background

`docs/dev/runtime-foundation.md` 在重试策略之后，下一步建议是补上节点授权上下文与 MCP 查询。
当前运行时已经具备：

- DAG 拓扑执行
- 条件/失败分支
- 节点级重试
- `run_events` 统一事件流

但还缺少一个最小可用的“按节点授权读取上下文”闭环，导致 `mcp_query` 节点虽然在 IR 中存在，却没有真实语义。

## Goal

在不新增表结构、不引入独立 MCP 服务的前提下，为 MVP 运行时补一个可追溯的最小实现：

- 为节点生成并注入 `AuthorizedContextRefs`
- 让 `mcp_query` 节点可以读取当前 Run 内已获授权的上游产出
- 把读取行为写入 `run_events`
- 在工作流创建阶段补齐最小配置校验

## Decision

### 1. 授权配置仍放在节点 `config`

本步没有扩展第二套内部 DSL，而是先沿用现有 `Node.config` 容器承载最小授权语义：

```json
{
  "contextAccess": {
    "readableNodeIds": ["planner"],
    "readableArtifacts": [
      { "nodeId": "search", "artifactType": "json" }
    ]
  },
  "query": {
    "type": "authorized_context",
    "sourceNodeIds": ["planner", "search"],
    "artifactTypes": ["json"]
  }
}
```

其中：

- `contextAccess` 定义节点被授权读取的来源
- `query` 目前仅用于 `mcp_query` 节点

### 2. 运行时统一注入 `AuthorizedContextRefs`

每次节点执行前，运行时都会把授权快照注入 `NodeRun.input_payload`：

- `currentNodeId`
- `readableNodeIds`
- `readableArtifacts`

这样普通节点和 `mcp_query` 节点都能看到一致的授权视图，后续前端调试面板也可以直接复用。

### 3. `mcp_query` 先只支持 `authorized_context`

本步不实现外部 MCP Provider，只支持：

- `query.type = authorized_context`

查询结果返回：

- 请求元数据
- 已授权且当前 Run 中已产出的节点结果

当前运行时只落地了 `json` 产物语义，因此授权查询也只会真正读取 `json` 输出。

### 4. 读取行为进入 `run_events`

当 `mcp_query` 成功读取授权上下文后，运行时额外写入：

- `node.context.read`

事件中记录：

- 发起读取的节点 ID
- 查询类型
- 实际读取到的 source node ids
- artifact types
- result count

这一步先满足最小审计与调试可追溯，不额外新增审计表。

### 5. 工作流定义补最小校验

当前增加的校验包括：

- `mcp_query` 节点必须定义 `config.query`
- `contextAccess` 引用的节点必须存在
- `query.sourceNodeIds` 引用的节点必须存在
- `query.sourceNodeIds` 必须是授权来源的子集

## Impact

- `api/app/schemas/workflow.py`
  - 增加 `contextAccess` / `query` 的最小结构校验
- `api/app/services/runtime.py`
  - 生成 `AuthorizedContextRefs`
  - 实现 `mcp_query` 的 `authorized_context` 查询
  - 新增 `node.context.read` 事件
- `api/tests/test_runtime_service.py`
  - 覆盖授权上下文注入与 `mcp_query` 执行
  - 覆盖未授权查询失败
- `api/tests/test_run_routes.py`
  - 验证 API 返回 `node.context.read` 事件
- `api/tests/test_workflow_routes.py`
  - 验证工作流创建时的授权查询校验

## Verification

Run from [`api`](E:/code/taichuCode/7flows/api):

```powershell
.\.venv\Scripts\pytest.exe -q
.\.venv\Scripts\python.exe -m ruff check app tests
```

## Current Boundary

这一步仍然没有实现：

- 外部 MCP 服务接入
- 非 `authorized_context` 查询类型
- `json` 之外的真实 artifact 存储与读取
- 更细粒度的字段级脱敏
- 前端调试面板对授权上下文的可视化展示
