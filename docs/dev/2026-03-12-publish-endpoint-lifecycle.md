# 2026-03-12 Publish Endpoint Lifecycle

## 背景

上一轮提交 `feat: persist workflow publish bindings` 已经把 `definition.publish` 收敛成独立持久化事实，但发布态还停留在“可查询、不可治理”的阶段：

- 新生成的 binding 没有生命周期状态
- 无法明确区分草稿、已发布和下线中的 endpoint
- 同一个 `endpoint_id` 在多版本之间缺少显式切换语义

这会直接卡住 `API 调用开放` 主线，因为后续无论是原生 endpoint 还是 OpenAI / Anthropic 协议映射，都需要先知道“哪一个 binding 当前真正处于已发布状态”。

## 目标

- 在现有 `workflow_published_endpoints` 之上补最小 lifecycle 边界
- 让 publish binding 从“静态快照”升级为“可治理 endpoint 绑定”
- 保持发布态继续绑定 `workflow_version + compiled_blueprint`
- 不把 endpoint lifecycle 逻辑重新塞回 `runtime.py`

## 决策与实现

### 1. 为 publish binding 增加生命周期字段

为 `workflow_published_endpoints` 新增：

- `lifecycle_status`
  - `draft`
  - `published`
  - `offline`
- `published_at`
- `unpublished_at`

其中：

- 新同步出来的 binding 默认进入 `draft`
- `draft` 表示定义和编译产物已经具备，但尚未对外开放
- `published` 表示当前 binding 是该 `endpoint_id` 的活动发布版本
- `offline` 表示曾经可用，但当前已下线

### 2. 新增 lifecycle 更新能力

在 `WorkflowPublishBindingService` 上新增 lifecycle 切换逻辑：

- 支持手动把 binding 切到 `published` 或 `offline`
- 不允许外部直接把 binding 改回 `draft`
  - `draft` 只保留给 definition/version 同步阶段自动产生的状态

### 3. 发布新版本时自动下线旧版本

当某个 binding 被切到 `published` 时：

- 同一 `workflow_id + endpoint_id` 下其他已发布 binding 会自动切到 `offline`
- 被下线的旧 binding 会写入 `unpublished_at`
- 新 binding 会写入新的 `published_at`

这样同一个 endpoint 在同一 workflow 下始终只有一个活动发布版本，避免未来开放 API 时出现“多个版本同时声称已发布”的歧义。

### 4. 保持路由边界独立

新增路由：

- `PATCH /api/workflows/{workflow_id}/published-endpoints/{binding_id}/lifecycle`

增强查询路由：

- `GET /api/workflows/{workflow_id}/published-endpoints`
  - 新增 `lifecycle_status` 过滤

这样发布态治理继续落在独立 `workflow_publish` route，而没有把 endpoint lifecycle 混回 `workflows.py` 的 detail/update 大包。

## 影响范围

- 模型与迁移
  - `api/app/models/workflow.py`
  - `api/migrations/versions/20260312_0011_publish_endpoint_lifecycle.py`
- 服务与路由
  - `api/app/services/workflow_publish.py`
  - `api/app/api/routes/workflow_publish.py`
- schema
  - `api/app/schemas/workflow_publish.py`
- 测试
  - `api/tests/test_workflow_publish_routes.py`

## 验证

```powershell
cd api
.\.venv\Scripts\python.exe -m pytest -q
.\.venv\Scripts\python.exe -m ruff check app\api\routes\workflow_publish.py app\models\workflow.py app\schemas\workflow_publish.py app\services\workflow_publish.py tests\test_workflow_publish_routes.py
```

结果：

- `107` 个后端测试全部通过
- 发布态相关 Ruff 检查通过

## 当前边界

- 现在已经有 publish binding lifecycle，但还没有真正的开放调用入口
- 尚未补：
  - endpoint alias / path
  - 发布态鉴权实体与 API key/token 生命周期
  - 限流 / cache / 协议级 request-response mapping
- lifecycle 目前仍以“binding 记录”为治理对象，后续若要支持更复杂的发布控制台，还需要补 endpoint 级聚合视图

## 下一步

1. 在 `published` binding 之上补最小 `native` 调用入口，真正打通开放 API 起点
2. 给 publish endpoint 增加 alias/path、鉴权和基础治理实体
3. 再把 OpenAI / Anthropic 协议映射挂到同一条 publish binding 主线，而不是旁路读取 workflow definition
