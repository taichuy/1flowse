# Runtime Foundation

## 目标

这次实现的目标不是一次性做完整工作流平台，而是把最关键、最容易成为后续瓶颈的基础设施先落稳：

- 迁移体系替代 `create_all`
- 运行态表结构落地
- 最小可用的工作流执行闭环
- Docker 启动前自动迁移

## 已落地能力

### 1. Alembic 迁移体系

后端已经引入 Alembic，主链路不再依赖应用启动时的 `Base.metadata.create_all()`。

当前文件：

- `api/alembic.ini`
- `api/migrations/env.py`
- `api/migrations/versions/20260309_0001_initial_runtime.py`

当前迁移会创建以下表：

- `workflows`
- `runs`
- `node_runs`
- `run_events`

### 2. Docker 自动迁移

`api` 镜像已增加启动脚本：

- `api/docker/entrypoint.sh`

当环境变量 `SEVENFLOWS_MIGRATION_ENABLED=true` 时，容器启动前会自动执行：

```bash
uv run alembic upgrade head
```

当前约定：

- `api` 服务默认自动迁移
- `worker` 服务默认不自动迁移

这样可以避免多个容器并发升级同一份数据库。

### 3. 运行态模型

当前运行态闭环的核心表如下：

#### `runs`

记录一次工作流执行实例：

- 状态
- 输入
- 输出
- 错误信息
- 起止时间

#### `node_runs`

记录每个节点的一次执行：

- 节点 ID / 名称 / 类型
- 输入输出
- 执行状态
- 错误信息
- 起止时间

#### `run_events`

记录统一事件流，用于后续调试面板、回放和流式输出复用。

当前已记录的事件类型包括：

- `run.started`
- `node.started`
- `node.skipped`
- `node.retrying`
- `node.output.completed`
- `node.context.read`
- `node.failed`
- `run.completed`
- `run.failed`

### 4. 工作流定义校验与版本快照

编排 API 已经补上“最小但真实可用”的设计态约束，避免工作流定义继续以裸 JSON 直接进入运行时。

当前已落地：

- 创建/更新工作流时执行结构校验，至少覆盖：
  - 必须且仅允许一个 `trigger` 节点
  - 至少存在一个 `output` 节点
  - 节点 ID / 连线 ID 唯一
  - 连线引用的源节点和目标节点必须存在
- 边定义会补齐默认 `channel=control`
- 每次定义变更都会自动创建不可变版本快照
- `runs` 会记录执行时绑定的 `workflow_version`

当前相关文件：

- `api/app/schemas/workflow.py`
- `api/app/services/workflow_definitions.py`
- `api/app/api/routes/workflows.py`
- `api/migrations/versions/20260309_0002_workflow_versioning.py`

当前最小版本管理策略：

- 工作流初始版本为 `0.1.0`
- 仅当 `definition` 发生变更时自动递增 patch 版本，例如 `0.1.0 -> 0.1.1`
- 纯名称修改不会创建新版本
- `workflow_versions` 用于保存不可变快照，供后续运行追溯、发布绑定和缓存失效复用

### 5. 最小工作流执行器

当前执行器位置：

- `api/app/services/runtime.py`

当前实现的是一个 MVP 级执行器，目标是先把“状态、事件、执行记录”打通，而不是完整支持全部节点语义。

当前特性：

- 基于 `nodes + edges` 做拓扑排序
- 检测循环并拒绝执行
- 支持 `trigger`
- 支持 `output`
- 支持基于激活边的条件分支 / 失败分支
- 支持节点级重试策略与退避参数
- 支持节点授权上下文注入与 `mcp_query.authorized_context`
- 支持 `condition` / `router` 通过最小规则选择器按输入命中分支
- 其他节点默认走统一占位执行逻辑
- 支持通过 `config.mock_output` 为节点声明稳定输出

这让我们可以先验证：

- 工作流是否能跑通
- 运行态是否能完整落库
- 调试与观测数据是否可复用

### 6. 运行 API

当前新增接口：

- `POST /api/workflows/{workflow_id}/runs`
- `GET /api/runs/{run_id}`
- `GET /api/runs/{run_id}/events`

用途：

- 触发一次最小工作流执行
- 查询执行详情
- 查询事件流

工作流设计态新增接口：

- `POST /api/workflows`
- `PUT /api/workflows/{workflow_id}`
- `GET /api/workflows/{workflow_id}`
- `GET /api/workflows/{workflow_id}/versions`

## 推荐开发命令

### 本地源码模式

```powershell
cd api
Copy-Item .env.example .env
uv sync --extra dev
uv run alembic upgrade head
uv run uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Worker:

```powershell
uv run celery -A app.core.celery_app.celery_app worker --loglevel INFO --pool solo
```

### Docker 全栈模式

```powershell
cd docker
Copy-Item .env.example .env
docker compose up -d --build
```

## 当前边界

这次实现故意没有往下做太深，避免把运行时和插件系统搅在一起。

当前还没有实现：

- 通用表达式引擎驱动的 DAG 条件语义
- 多上游 join / 汇聚语义
- Loop 节点执行
- 外部 MCP Provider 接入
- 插件兼容代理
- 流式响应映射
- 回放调试面板

## 下一步建议

建议按下面顺序继续：

1. 在规则选择器之上补安全表达式能力与更完整的 DAG 条件语义
2. 实现多上游 join / 汇聚约束，避免分支合流继续靠“谁先写入”隐式决定
3. 实现 Dify 插件兼容代理
4. 把 `run_events` 接到前端调试面板
5. 再回头收紧更完整的 `7Flows IR` 校验和发布态版本治理
