# 2026-03-12 Publish Governance Invocation Filters

## 背景

上一轮已经把 publish governance 推进到：

- published invocation audit 支持 `reason_code` 信号聚合
- workflow 页可以看到 issue signals、rate limit pressure、API key usage 和 timeline

但这仍然停留在“有信号可看”的阶段。用户如果想追问“只看某个原因码、某个 API key、某个入口、某个时间窗”，workflow 页还没有直接消费这些能力。

## 目标

把 publish governance 从静态摘要继续推进成最小可钻取视图，同时保持当前解耦边界：

- 后端继续复用 `published_endpoint_activity` 路由和 `PublishedInvocationService`
- 前端继续围绕 workflow 页的 publish governance 面板演进
- 不为筛选交互单独引入第二套事实模型或页面内私有统计状态

## 实现

### 1. 后端补上 `reason_code` 查询参数

更新：

- `api/app/schemas/workflow_publish.py`
- `api/app/api/routes/published_endpoint_activity.py`
- `api/app/services/published_invocations.py`

当前 `/api/workflows/{workflow_id}/published-endpoints/{binding_id}/invocations` 新增：

- `reason_code`

实现方式：

- `PublishedInvocationService` 先继续用数据库过滤 `status / request_source / api_key_id / created_from / created_to`
- 当传入 `reason_code` 时，再基于统一的 `classify_invocation_reason()` 做二次过滤
- `list_for_binding()` 与 `build_binding_audit()` 共用同一条过滤路径，避免“列表一套、摘要一套”的偏差

这保证：

- 响应里的 `filters`、`summary`、`facets` 和 `items` 始终针对同一批 invocation records
- `reason_code` 仍然是 publish governance 的派生治理信号，而不是倒灌进 runtime 主执行模型

### 2. workflow 页接入 binding 级服务器端筛选

更新：

- `web/app/workflows/[workflowId]/page.tsx`
- `web/lib/get-workflow-publish.ts`
- `web/lib/get-workflow-publish-governance.ts`
- `web/components/workflow-publish-panel.tsx`
- `web/components/workflow-publish-binding-card.tsx`
- `web/components/workflow-publish-activity-panel.tsx`

当前 workflow 页新增 binding 级 invocation filter form，支持：

- `status`
- `request_source`
- `reason_code`
- `api_key_id`
- `time window`（`24h / 7d / 30d / all`）

实现方式：

- 过滤条件通过 query params 挂在 workflow 页 URL 上
- 只有被选中的 binding 才应用筛选，其他 binding 保持默认最近调用摘要
- `web/lib/get-workflow-publish-governance.ts` 负责把 active binding 的过滤条件透传到 `/invocations`

这样保持了两个边界：

- 前端仍然是 server-driven filter，不需要在浏览器里维护第二套 publish audit 计算逻辑
- workflow 页继续保持“页面装配 + 卡片组合”，筛选装配收口到独立 loader，而不是重新堆回 page component

## 影响范围

- 发布治理现在从“看 summary”推进到“按问题聚焦”
- API key、原因码、入口来源和时间窗已经具备最小 drilldown 闭环
- `workflow-publish-activity-panel.tsx` 体量继续增长，后续若再长出协议面治理或更细图表，应优先拆 `filter form / summary / timeline / recent items`

## 验证

后端：

```powershell
cd api
.\.venv\Scripts\uv.exe run pytest tests/test_workflow_publish_routes.py -q
```

结果：

- `21 passed`

前端：

```powershell
cd web
pnpm exec tsc --noEmit
```

结果：

- 类型检查通过

## 下一步

1. 继续补 publish governance 的协议面治理，而不是再回去堆新的静态摘要
2. 把 streaming / SSE 接到同一条 publish binding + run events 主线
3. 若 publish governance 继续扩张，优先拆 `workflow-publish-activity-panel.tsx`
