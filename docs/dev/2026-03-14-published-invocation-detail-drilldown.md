# 2026-03-14 Published Invocation Detail Drilldown

## 背景

- 最近一条真正承接主线的功能提交是 `4d18eba refactor: split agent runtime llm and publish audit services`。
- 那次提交完成了 `PublishedInvocationService` 的结构拆分，但 `docs/dev/runtime-foundation.md` 里明确留下了一个 P0 缺口：**补单次 invocation detail，以及 invocation 到 `run / callback ticket / cache` 的稳定钻取入口**。
- 此前发布治理已经能回答“最近谁在调、有没有被限流、失败原因是什么”，但仍停留在 binding 级 summary/list；当用户或后续 UI 需要定位某一条 invocation 时，还缺稳定事实链路。

## 目标

1. 为 published invocation 增加单条 detail API，而不是继续把所有信息塞进 list response。
2. 让 invocation 记录持久化 cache drilldown 所需的稳定引用，避免 detail 只能做“模糊匹配”。
3. 继续复用 `runs / node_runs / run_callback_tickets / workflow_published_cache_entries` 这些现有事实源，不新造平铺状态表。

## 实现方式

### 1. Invocation 持久化补 cache 引用

- 在 `api/app/models/workflow.py` 为 `WorkflowPublishedInvocation` 新增：
  - `cache_key`
  - `cache_entry_id`
- 新增迁移 `api/migrations/versions/20260314_0020_published_invocation_cache_links.py`，确保真实数据库 schema 与 ORM 对齐。
- `PublishedInvocationService.record_invocation()` 新增 `cache_key` / `cache_entry_id` 入参，并提供 `get_for_binding()` 作为单条记录读取入口。

### 2. Publish gateway 在命中/写入缓存时同步记录引用

- `api/app/services/published_cache.py`
  - `PublishedEndpointCacheHit` 现在会返回 `entry_id`
  - 新增 `get_inventory_item()`，用于按 `cache_entry_id` 稳定回查当前活跃 cache entry
- `api/app/services/published_gateway.py`
  - cache hit 时记录 `cache_key + cache_entry_id`
  - cache miss 且成功写入时，同步记录新建 cache entry 的 `id`
  - 这样 invocation detail 不必依赖 request/response preview 去猜是哪条 cache entry

### 3. 单条 detail API 与路由解耦

- 新增 `api/app/api/routes/published_endpoint_invocation_detail.py`
  - 路由：`GET /api/workflows/{workflow_id}/published-endpoints/{binding_id}/invocations/{invocation_id}`
  - 返回：
    - `invocation`
    - `run`
    - `callback_tickets`
    - `cache`
- 新增 `api/app/api/routes/published_endpoint_invocation_support.py`
  - 复用 invocation item、waiting lifecycle、callback ticket、cache inventory 的序列化逻辑
  - 避免把 `published_endpoint_activity.py` 继续长成既管 list 又管 detail 的大路由文件
- `api/app/api/routes/published_endpoint_activity.py` 改为复用共享 helper，继续只负责 binding 级 list/audit 输出。

## 影响范围

- `api/` 发布治理 API 现在同时具备：
  - binding 级 summary/list 审计
  - invocation 级 detail 钻取
- 发布治理后端事实源仍保持单一：
  - invocation 记录负责入口级审计
  - run / node_run / callback ticket 负责运行态事实
  - cache entry 负责缓存事实
- 这轮没有改动前端 publish panel；前端仍旧消费 list API，但现在已经有稳定的后端 detail 契约可回接。

## 当前边界

- 历史 invocation 记录不会自动回填 `cache_key / cache_entry_id`；detail API 对旧记录仍可用，但 cache drilldown 可能为空。
- 当前 detail API 暂不直接内联完整 `RunDetail`，而是返回 run reference + callback tickets；更深的运行态仍应继续跳转现有 run detail / run views API。
- `api/app/services/published_gateway.py` 仍是发布主线最大热点文件之一，这轮只补事实链路，没有继续拆 protocol surface。

## 验证

- `./.venv/Scripts/uv.exe run pytest tests/test_workflow_publish_routes.py -q`：24 passed
- `./.venv/Scripts/uv.exe run pytest tests/ -q`：213 passed

## 下一步

1. **P0：前端接入 invocation detail drilldown**
   - 在 publish panel 中为单条 invocation 增加 detail drawer / side panel
   - 把 `run / callback ticket / cache` 三类事实真正暴露给人类排障入口
2. **P1：继续拆 `published_gateway.py`**
   - 优先沿 protocol surface / response builder / audit handoff 边界分拆
3. **P1：补流式 usage 回传**
   - 在 `LLMProviderService` 为 OpenAI streaming 打通 `stream_options.include_usage`
4. **P1：观察新的结构热点**
   - `published_invocation_audit.py`
   - `runtime.py`
   - `run-diagnostics-panel.tsx`
