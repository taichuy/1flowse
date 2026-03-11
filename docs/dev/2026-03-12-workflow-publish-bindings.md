# 2026-03-12 Workflow Publish Bindings

## 背景

上一轮提交 `feat: add run execution and evidence views` 已把运行态事实收口成 execution / evidence 聚合查询，但发布态仍停留在 `workflow.definition.publish` 的文档化配置：

- 只有 schema 校验，没有独立持久化事实
- 没有和 `workflow_version + compiled_blueprint` 建立正式绑定
- 没有最小查询接口，后续开放 API、发布治理和回放都缺少稳定入口

这意味着 `compiled blueprint` 虽然已经成为运行态事实，但还没有真正承接到发布态。

## 目标

- 把 `definition.publish` 从“设计态字段”推进成真实后端事实
- 明确每个 published endpoint 绑定的是哪一个 `workflow_version`
- 同时把 binding 指向具体的 `compiled_blueprint`
- 提供独立查询接口，避免把发布态逻辑继续塞回 `workflows.py` 或 `runtime.py`

## 决策与实现

### 1. 新增持久化表 `workflow_published_endpoints`

新增表保存每条 publish binding 的最小必要事实：

- 声明该 binding 的 `workflow_version_id + workflow_version`
- 真正被发布的 `target_workflow_version_id + target_workflow_version`
- 绑定到的 `compiled_blueprint_id`
- endpoint 元数据：`endpoint_id / endpoint_name / protocol / auth_mode / streaming`
- `input_schema / output_schema`

这让发布态第一次拥有了独立事实层，而不再只是 workflow definition 里的嵌套 JSON。

### 2. 新增 `WorkflowPublishBindingService`

新增：

- `api/app/services/workflow_publish.py`

职责：

- 读取某个 `workflow_version.definition.publish`
- 解析每个 endpoint 的目标版本
  - `publish[].workflowVersion` 有值时绑定到指定版本
  - 否则默认绑定到当前 definition 对应的版本
- 校验目标版本是否存在
- 保证目标版本拥有 `compiled_blueprint`
- 同步生成 / 更新当前 definition snapshot 下的 publish bindings

如果 endpoint 指向不存在的 workflow version，会在 create/update 阶段直接返回 `422`，而不是把坏配置留到未来发布时才暴露。

### 3. 新增独立查询路由

新增：

- `GET /api/workflows/{workflow_id}/published-endpoints`

支持：

- 默认返回当前 workflow 最新版本声明的 publish bindings
- `workflow_version` 查询指定 definition snapshot
- `include_all_versions=true` 查看全量历史 bindings

这样发布态已经有了独立查询面，不需要继续依赖 `GET /api/workflows/{workflow_id}` 把全部状态混在一个 detail 包里。

### 4. 保持当前架构边界

这次没有把发布态直接做成开放协议执行器，也没有把 OpenAI / Anthropic 映射塞回 runtime 主循环，而是先补最小事实边界：

- `workflow definition`
  -> `workflow version`
  -> `compiled blueprint`
  -> `workflow published endpoint binding`

后续开放 API 和 publish gateway 应继续建立在这条链路之上，而不是重新读取松散的 definition JSON。

## 影响范围

- 模型与迁移
  - `api/app/models/workflow.py`
  - `api/migrations/versions/20260312_0010_workflow_published_endpoints.py`
- 服务与路由
  - `api/app/services/workflow_publish.py`
  - `api/app/api/routes/workflow_publish.py`
  - `api/app/api/routes/workflows.py`
- schema
  - `api/app/schemas/workflow_publish.py`
- 测试
  - `api/tests/test_workflow_publish_routes.py`

## 验证

```powershell
cd api
.\.venv\Scripts\python.exe -m pytest tests\test_workflow_routes.py tests\test_workflow_publish_routes.py
.\.venv\Scripts\python.exe -m ruff check app\api\routes\workflows.py app\api\routes\workflow_publish.py app\models\workflow.py app\models\__init__.py app\schemas\workflow_publish.py app\services\workflow_publish.py tests\test_workflow_publish_routes.py
```

结果：

- 29 个相关测试通过
- Ruff 检查通过

## 当前边界

- 现在只是把 publish binding 变成真实事实，还没有直接提供 `native / openai / anthropic` 的公开调用入口
- publish binding 目前仍是“按 workflow version 声明的 endpoint snapshot”，还没有补：
  - API key / token 的发布态鉴权实体
  - endpoint alias / path / 限流 / cache 策略
  - publish lifecycle（草稿 / 已发布 / 下线）
  - protocol request/response mapping
- `runtime.py` 当前已到 1500+ 行，说明后续若继续补 scheduler / publish gateway / callback 治理，必须优先拆 waiting/resume orchestration，而不是继续堆主执行器

## 下一步

1. 在 publish binding 之上补最小发布态 endpoint 实体和生命周期
2. 把 `native / openai / anthropic` 协议映射挂到 publish binding，而不是直接读取 workflow definition
3. 继续收口 callback ticket 的过期、审计和鉴权治理
