# 2026-03-12 Published Endpoint API Keys

## 背景

上一轮已经把 published binding、lifecycle 和最小 native invoke 接到 `workflow_version + compiled_blueprint` 主线上，但 `auth_mode=api_key` 仍然只是占位语义：

- publish binding 可以声明 `api_key`
- native published gateway 实际仍只接受 `internal`
- 一旦工作流要作为对外 API 交付，就会直接卡在“有发布定义但没有真实鉴权实体”

这会让 `API 调用开放` 这条主业务线停留在“能发布、不能安全调用”的半闭环状态。

## 目标

本轮只补最小但真实可用的 `api_key` 能力，不提前做完整发布网关：

- 为 published endpoint 增加独立 API key 实体
- 让 key 生命周期与 workflow version / binding version 解耦
- 让 native published gateway 可以真正校验 `api_key`
- 保持 `token`、streaming、rate limit、cache 等能力继续诚实占位

## 决策与实现

### 1. API key 作为独立发布事实，不绑定单一 binding 版本

新增表：

- `workflow_published_api_keys`

核心字段：

- `workflow_id`
- `endpoint_id`
- `name`
- `key_prefix`
- `key_hash`
- `status`
- `last_used_at`
- `revoked_at`

这样 API key 挂在 `workflow_id + endpoint_id` 上，而不是挂在单个 `binding_id` 上。

原因：

- 同一个 published endpoint 在版本切换时，active binding 会变化
- 如果 key 绑在单一 binding 上，每次发布新版本都需要重建 key
- 对外调用者关心的是“这个 endpoint 能否继续调用”，不是底层 binding 是否换版

管理入口仍然接受 `binding_id`，但只是把它当作“定位 endpoint 的入口”，真正持久化时收口到 `workflow_id + endpoint_id`。

### 2. 只保存 hash，不保存明文 key

实现方式：

- 创建时生成 `sf_pub_*` 风格 secret
- 持久化 `key_prefix` 供 UI/日志识别
- 持久化 `SHA256(secret)` 作为校验值
- 明文只在创建响应中返回一次

这样当前 MVP 虽然还没有完整凭证治理，但至少不会把发布 key 明文落库。

### 3. 发布层管理与调用层校验分离

新增 service：

- `api/app/services/published_api_keys.py`

新增 API：

- `GET /api/workflows/{workflow_id}/published-endpoints/{binding_id}/api-keys`
- `POST /api/workflows/{workflow_id}/published-endpoints/{binding_id}/api-keys`
- `DELETE /api/workflows/{workflow_id}/published-endpoints/{binding_id}/api-keys/{key_id}`

发布调用入口仍维持：

- `POST /v1/workflows/{workflow_id}/published-endpoints/{endpoint_id}/run`

其中 gateway 只负责：

- 解析 `x-api-key`
- 或回退读取 `Authorization: Bearer <key>`
- 将 key 交给发布层鉴权 service 校验

这样没有把 header 解析、key 生命周期、binding 解析和 runtime 调用混回 `RuntimeService`。

### 4. 保持 MVP 诚实边界

本轮明确没有假装补齐以下能力：

- `token` auth
- publish alias/path
- rate limit / cache
- streaming published invoke
- OpenAI / Anthropic publish gateway

当前仍然只把 `native + internal/api_key + non-streaming` 作为最小真实可用闭环。

## 影响范围

后端：

- `api/app/models/workflow.py`
- `api/app/services/published_api_keys.py`
- `api/app/services/published_gateway.py`
- `api/app/api/routes/published_endpoint_keys.py`
- `api/app/api/routes/published_gateway.py`
- `api/app/schemas/workflow_publish.py`
- `api/migrations/versions/20260312_0012_published_endpoint_api_keys.py`

测试：

- `api/tests/test_published_endpoint_api_keys.py`
- `api/tests/test_workflow_publish_routes.py`

## 验证

已执行：

```powershell
cd api
.\.venv\Scripts\python -m pytest tests/test_workflow_publish_routes.py tests/test_published_endpoint_api_keys.py -q
.\.venv\Scripts\python -m ruff check app/api/routes/published_gateway.py app/api/routes/published_endpoint_keys.py app/services/published_gateway.py app/services/published_api_keys.py app/schemas/workflow_publish.py app/models/workflow.py tests/test_workflow_publish_routes.py tests/test_published_endpoint_api_keys.py
```

结果：

- `11 passed`
- `ruff check` 通过

## 当前结论

发布层已经从：

- `published binding + lifecycle + native invoke`

推进到：

- `published binding + lifecycle + native invoke + api_key entity/auth`

这意味着 `API 调用开放` 不再只有内部调用模式，开始具备最小对外保护能力。

## 下一步

按优先级建议继续：

1. 补 publish alias/path 与发布实体治理，让 published endpoint 具备更稳定的外部地址语义
2. 在同一发布链路上继续补 OpenAI / Anthropic 映射，而不是另起执行入口
3. 补 publish rate limit / cache / audit，把发布层从“可调用”推进到“可托管”
4. 再回头收口 `token` auth 和更完整的凭证/密钥治理
