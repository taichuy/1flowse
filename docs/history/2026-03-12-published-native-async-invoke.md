# 2026-03-12 Published Native Async Invoke

## 背景

本轮先重新对齐了以下事实来源：

- `AGENTS.md`
- `docs/dev/user-preferences.md`
- `docs/product-design.md`
- `docs/technical-design-supplement.md`
- `docs/dev/runtime-foundation.md`
- 最近一次 Git 提交 `a16f9d3e3792186bf0c76d76073cd45f57a95e49`（`feat: add publish cache status governance`）

当前项目判断已经不是“基础框架有没有写”，而是“开放 API 这条主业务线还差哪段闭环”。上一轮提交继续把 publish governance 做深，但 `published endpoint` 仍有一个明显缺口：

- sync published invoke 遇到 durable waiting workflow 时只能返回 `409`
- 这让已具备 waiting/callback/resume 语义的 runtime，仍然无法通过原生 published endpoint 被诚实消费

## 目标

补一个最小但真实可用的 `native published async invoke`：

- 不假装已经做完 OpenAI / Anthropic streaming
- 不引入第二套 runtime
- 继续沿 `publish binding -> compiled blueprint -> runtime run` 主线推进
- 让 `waiting` workflow 至少能通过原生 published endpoint 返回 `RunDetail` 与可继续追踪的 `run_id`

## 本轮实现

### 1. 新增 native async invoke 入口

新增三个原生 published endpoint 入口：

- `POST /v1/workflows/{workflow_id}/published-endpoints/{endpoint_id}/run-async`
- `POST /v1/published-aliases/{endpoint_alias}/run-async`
- `POST /v1/published-paths-async/{route_path:path}`

说明：

- `workflow` / `alias` 继续保持和同步入口一致的定位
- `path` 入口单独采用 `published-paths-async` 前缀，是为了避免 `{route_path:path}` 与 `/run-async` 后缀在 FastAPI 路由匹配上互相吞噬

### 2. 发布网关允许 native async 接住 waiting run

`PublishedEndpointGatewayService` 本轮新增了 native async 调用分支：

- 仍然走 active `publish binding`
- 仍然固定绑定 `target_workflow_version + compiled_blueprint`
- 仍然复用现有 API key、rate limit、cache 和 invocation audit
- 仅对 native async 关闭“必须同步成功”的硬性限制

结果是：

- sync native invoke 仍保持当前诚实边界：`waiting -> 409`
- native async invoke 遇到 `run.status=waiting` 时，改为返回 `202 + RunDetail`

### 2.1 waiting 响应不再写入 publish cache

本轮继续补了一个实际 correctness 缺口：

- 如果 async native invoke 命中了 `cache_policy`，但 workflow 本次返回的是 `run.status=waiting`
- 这类响应不能进入 publish cache，否则后续同参请求会直接复用旧的 `run_id + waiting` 结果

当前收口方式：

- `native async` 仍会先检查已有 cache hit
- 只有 `run.status=succeeded` 的原生响应才允许写入 publish cache
- `run.status=waiting` 的 async 响应现在会显式保持 `X-7Flows-Cache: BYPASS`

这样不会把 durable run 的中间态误当成可重放的稳定发布响应。

### 3. 新增发布响应头，显式暴露运行状态

native published routes 现在会统一返回：

- `X-7Flows-Cache`
- `X-7Flows-Run-Status`

这样调用方可以不展开完整 body，也能快速知道当前是 `SUCCEEDED / FAILED / WAITING` 哪一种运行态。

### 4. invocation audit 继续复用同一事实层

这轮没有为 async invoke 新造一套审计模型，而是继续写入 `workflow_published_invocations`：

- `request_source` 仍区分 `workflow / alias / path`
- `run_id` / `run_status` 继续回写
- waiting run 当前按“请求成功接入 runtime”记录为 `status=succeeded + run_status=waiting`

这条语义的取舍是：

- 先保证“调用有没有接住 durable run”可见
- 不在本轮把 publish activity 状态机再次扩张成更复杂的 `accepted / running / completed`

后续如果开放 API 治理继续深入，再考虑是否把 request-level status 与 run-level status 做更细拆分。

### 5. publish governance 现在能区分 native sync / async surface

为了不给后续 streaming / async 治理留下盲点，这轮顺手把 invocation audit 的协议面细化了：

- `native.workflow`
- `native.workflow.async`
- `native.alias`
- `native.alias.async`
- `native.path`
- `native.path.async`

这样 binding 级 activity / timeline / request surface filter 不会把原生 sync 和 async 调用混在一起。

## 影响范围

- `api/app/services/published_gateway.py`
- `api/app/services/published_invocations.py`
- `api/app/api/routes/published_gateway.py`
- `api/app/schemas/workflow_publish.py`
- `api/tests/test_published_native_async_routes.py`
- `api/tests/workflow_publish_helpers.py`
- `api/tests/test_workflow_publish_routes.py`
- `web/lib/get-workflow-publish.ts`
- `web/lib/get-workflow-publish-governance.ts`
- `web/lib/published-invocation-presenters.ts`
- `web/components/workflow-publish-activity-panel.tsx`
- `docs/dev/runtime-foundation.md`

## 验证

已执行针对性验证：

```powershell
api\.venv\Scripts\uv.exe run --project api pytest api/tests/test_published_native_async_routes.py api/tests/test_workflow_publish_routes.py api/tests/test_workflow_publish_activity.py
```

结果：

- `test_published_native_async_routes.py`: passed
- `test_workflow_publish_routes.py`: passed
- `test_workflow_publish_activity.py`: passed

## 当前结论

- 上一次提交需要衔接，而且这轮仍然沿 `API 调用开放 -> publish binding/governance` 主线推进
- 基础框架已经足够支撑继续补主业务闭环，不需要再回头证明“有没有框架”
- 当前新增能力优先服务真实业务缺口：让 durable waiting workflow 可以通过原生 published endpoint 被接住
- OpenAI / Anthropic 的 streaming / SSE 仍未完成，不能假装已经补齐

## 下一步

按当前优先级，建议下一步继续：

1. P0：把 `native async invoke` 继续推进到统一发布治理
   - 在 publish activity 中继续细化 request-level success 与 `run_status=waiting` 的治理表达
   - 为 async invoke 补更明确的前端治理文案与筛选
2. P0：继续补 OpenAI / Anthropic 的 streaming / SSE
   - 仍坚持从统一事件流映射，不另起协议私有执行链
3. P1：继续拆控制边界
   - `runtime.py` 仍超过后端 1500 行偏好阈值
   - publish protocol / async lifecycle 若继续扩张，应优先避免再把 orchestration 堆回 `runtime.py`
