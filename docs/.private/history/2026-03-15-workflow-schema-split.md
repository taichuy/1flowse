# 2026-03-15 Workflow Schema 子模型拆分与结构热点衔接

## 背景

- 用户要求先结合 `AGENTS.md`、产品/技术基线、`runtime-foundation` 和最近 Git 提交复核项目现状，再按优先级继续开发并补文档留痕。
- 最新一次 Git 提交 `b2ca56e refactor: split workflow library catalog helpers` 已把 `workflow_library.py` 的 catalog/source 热点收口到 helper 层；根据当时的开发记录，下一条最自然的衔接线就是继续治理 `api/app/schemas/workflow.py` 这个工作流定义热点。
- `workflow.py` 当时仍同时承载 IR schema、runtime policy、publish schema 与跨节点校验，已经成为 workflow 规则继续演进时的主要集中点。

## 目标

1. 把 `workflow.py` 中增长方向明显不同的 publish/runtime policy 子模型拆到独立模块。
2. 保持 `WorkflowDefinitionDocument`、workflow routes 与 publish binding service 的现有行为不变。
3. 为后续继续拆 validator helper、workflow route/service 集中职责预留更清晰的边界。

## 实现

### 1. 拆出 runtime policy 子模块

- 新增 `api/app/schemas/workflow_runtime_policy.py`，承接：
  - `ExecutionClass / ExecutionNetworkPolicy / ExecutionFilesystemPolicy`
  - `WorkflowNodeRetryPolicy`
  - `WorkflowNodeJoinPolicy`
  - `WorkflowNodeExecutionPolicy`
  - `WorkflowNodeRuntimePolicy`
- `workflow.py` 继续保留 workflow node / edge / variable / document 等主 IR 结构，只按需引用这些子模型。

### 2. 拆出 published endpoint 子模块

- 新增 `api/app/schemas/workflow_published_endpoint.py`，承接：
  - `PublishProtocol / AuthMode`
  - alias/path normalize helper
  - published endpoint rate-limit/cache policy
  - `WorkflowPublishedEndpointDefinition`
- `api/app/services/workflow_publish.py` 与 `api/app/schemas/workflow_publish.py` 改为直接引用这个新模块，减少“publish 领域却只能回到 `workflow.py` 取定义”的耦合。

### 3. 收口聚合文件角色

- `api/app/schemas/workflow.py` 从约 725 行降到约 476 行。
- 当前聚合文件的职责更接近“workflow IR 主文档 + cross-node validation”，不再同时挤压 publish/runtime policy 的所有细节。
- `api/app/schemas/__init__.py` 同步补上新增模块导出名，保持 package 索引可追溯。

## 影响范围

- `api/app/schemas/workflow.py`
- `api/app/schemas/workflow_runtime_policy.py`
- `api/app/schemas/workflow_published_endpoint.py`
- `api/app/schemas/workflow_publish.py`
- `api/app/services/workflow_publish.py`
- `docs/dev/runtime-foundation.md`

## 验证

在 `api/` 目录执行：

```powershell
.\.venv\Scripts\uv.exe run ruff check app/schemas/workflow.py app/schemas/workflow_runtime_policy.py app/schemas/workflow_published_endpoint.py app/schemas/workflow_publish.py app/services/workflow_publish.py
.\.venv\Scripts\uv.exe run pytest -q tests/test_workflow_routes.py tests/test_workflow_publish_routes.py
.\.venv\Scripts\uv.exe run pytest -q
```

结果：

- `ruff check`：通过
- `pytest -q tests/test_workflow_routes.py tests/test_workflow_publish_routes.py`：通过，`53 passed`
- `pytest -q`：通过，`227 passed`

## 当前结论

- 最近一次 `workflow_library` 拆分已经得到自然承接：当前工作流定义热点不再只有一个大文件承接所有增长方向。
- 基础框架继续保持可持续推进状态：runtime、publish、compat 和 editor 主线没有被新拆分破坏，workflow route/publish binding 行为验证仍然稳定。
- 当前项目仍未达到“只剩人工逐项界面设计/验收”的阶段，因此本轮不触发通知脚本。

## 下一步

1. 继续把 `workflow.py` 里的 cross-node validator 拆成 helper，避免 node/edge/publish 规则继续堆回聚合文件。
2. 沿同一条主线继续治理 `api/app/api/routes/workflows.py` 与相关 service 的集中职责，尤其是 detail/version serialization 与 compiled blueprint/publish binding orchestration。
3. 回到 P0 主线，继续推进真实 execution adapter、统一敏感访问控制闭环和 `WAITING_CALLBACK` 后台唤醒。
