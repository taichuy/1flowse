# 2026-03-12 Publish Governance Request Surfaces

## 背景

上一轮已经把 publish governance 推进到：

- invocation audit 支持 `status / request_source / reason_code / api_key_id / time window`
- workflow 页已经能按 binding 级筛选最近调用、原因码和 API key 使用

但开放 API 仍缺一个关键治理维度：

- 同样都是 `request_source=workflow`，原生 workflow route、OpenAI chat.completions、OpenAI responses、Anthropic messages 其实是不同协议面
- 如果不把“请求命中了哪个 surface”显式暴露出来，后续协议治理、缓存隔离和 streaming 排障都会继续混在一起

## 目标

补上 publish invocation 的 `request_surface` 维度，并把它做成真正的前后端闭环：

- 后端 `/invocations` 能返回 surface 字段、surface facets，并支持按 surface 过滤
- workflow 页的 publish governance 面板能选择、回显和展示 surface
- 不把这层协议治理信息倒灌进 runtime 主模型，继续保持它属于 publish audit 的派生事实

## 实现

### 1. 后端补上 `request_surface`

更新：

- `api/app/schemas/workflow_publish.py`
- `api/app/api/routes/published_endpoint_activity.py`
- `api/app/services/published_invocations.py`

实现方式：

- 在 publish schema 中新增 `PublishedEndpointInvocationRequestSurface`
- `PublishedInvocationService` 新增 `resolve_request_surface()`，把 invocation 归类为：
  - `native.workflow`
  - `native.alias`
  - `native.path`
  - `openai.chat.completions`
  - `openai.responses`
  - `openai.unknown`
  - `anthropic.messages`
  - `unknown`
- `/invocations` 的 `filters / facets / items` 统一复用这条解析逻辑，继续保持“列表、摘要、facet 来自同一批 records”

当前实现仍是派生治理信号：

- 原生入口通过 `protocol + request_source` 判断
- OpenAI surface 通过 request preview keys 区分 `messages` 和 `input`
- 这保证了协议面治理先闭环，但没有把 surface 强行写回 runtime 主执行链

### 2. workflow 页把 `request_surface` 接成真正可用的筛选

更新：

- `web/app/workflows/[workflowId]/page.tsx`
- `web/components/workflow-publish-panel.tsx`
- `web/components/workflow-publish-binding-card.tsx`
- `web/components/workflow-publish-activity-panel.tsx`
- `web/lib/get-workflow-publish.ts`
- `web/lib/get-workflow-publish-governance.ts`
- `web/lib/published-invocation-presenters.ts`
- `web/lib/workflow-publish-governance.ts`

实现方式：

- workflow 页继续用 query params 驱动 binding 级服务器端筛选
- `WorkflowPublishActivityPanel` 新增 `Request surface` 下拉
- active filter chips、traffic mix 区和 recent items 现在都会显示 surface label
- 新增 `web/lib/workflow-publish-governance.ts` 收口 publish activity 面板共用的 active filter 类型，避免 page / panel / card / activity panel 继续复制同一个内联对象类型

## 影响范围

- publish governance 现在可以明确回答“最近打到的是哪个协议面”，而不是只知道来自哪类入口
- 这让后续 streaming、协议字段补齐、cache surface 隔离和 API 网关治理有了更稳定的观察维度
- 前端继续保持 page 装配、panel/card/activity 分层，没有把 surface 过滤状态重新堆回 page component

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

1. 继续把 protocol surface 治理推进到 streaming / SSE，可见性继续复用同一条 publish audit 主线
2. 若 `WorkflowPublishActivityPanel` 继续长出更多协议治理区块，优先拆 `filters / traffic mix / timeline / recent items`
3. 评估是否把高频 surface 归类持久化，避免未来 invocation audit 量上来后继续全量派生过滤
