# 2026-03-12 Publish Governance Timeline Breakdowns

## 背景

上一条正式 Git 提交 `feat: add publish invocation request surfaces` 已经把发布治理从“按入口筛选”推进到“按协议面筛选”。但当前 workflow 页面仍主要展示总量时间线，无法直接回答：

- 哪种 request surface 在某个时间窗开始放量
- 哪个失败原因是在最近几个时间桶里持续出现

这会让开放 API 治理仍停留在“看最近记录”和“看总量摘要”，还不够支撑协议面排障。

## 目标

- 在不提前引入 streaming 或更重图表基础设施的前提下，继续推进 `API 调用开放` 的 P0 发布治理
- 让 `/invocations` 时间桶直接返回 request surface / reason code 拆解
- 保持前端发布治理面板继续按职责拆分，不把趋势渲染重新塞回主活动面板

## 实现

### 后端

- 扩展 `PublishedEndpointInvocationTimeBucketItem`，新增：
  - `request_surface_counts`
  - `reason_counts`
- `PublishedInvocationService._build_timeline()` 现在会在每个时间桶内继续聚合：
  - request surface 次数
  - 稳定 reason code 次数
- 保持已有 `status / request_source / request_surface / api_key_id / reason_code / created_from / created_to` 过滤不变，时间桶拆解直接复用同一批过滤后的 invocation 事实

### 前端

- 新增 `web/components/workflow-publish-traffic-timeline.tsx`
  - 专门渲染 traffic timeline
  - 每个时间桶展示总量、成功/失败/拒绝，以及 top request surface / top reason signal
- `workflow-publish-activity-panel.tsx` 把时间线区块拆出去，继续承担：
  - 筛选表单
  - traffic mix
  - rate-limit window
  - issue signals
  - API key usage
  - recent invocations

## 影响范围

- `api/app/services/published_invocations.py`
- `api/app/api/routes/published_endpoint_activity.py`
- `api/app/schemas/workflow_publish.py`
- `api/tests/test_workflow_publish_routes.py`
- `web/components/workflow-publish-activity-panel.tsx`
- `web/components/workflow-publish-traffic-timeline.tsx`
- `web/lib/get-workflow-publish.ts`

## 验证

- 使用 `api/.venv` 和 `uv` 执行：

```powershell
cd api
.\.venv\Scripts\uv.exe run pytest tests/test_workflow_publish_routes.py -q
```

- 结果：`21 passed`

## 当前结论

- 这轮改动是对上一条 Git 提交的直接衔接，不是另起新主线
- 发布治理已经从“按 request surface 筛选”推进到“按时间桶观察 request surface / reason signal 趋势”
- 这仍然属于 `API 调用开放` 的 P0 承接，尚未越界到 streaming / protocol full fidelity

## 下一步

1. 继续补 streaming / SSE 的发布链路与治理可见性，保持绑定 `workflow_version + compiled_blueprint`
2. 在当前时间桶拆解基础上补 API key 趋势，避免治理视图仍停留在静态 key usage 列表
3. 视 publish panel 增长情况，继续把 summary / recent items 拆成更独立区块，避免活动面板重新变胖
