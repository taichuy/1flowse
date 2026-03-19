# 2026-03-16 Sensitive Access Inbox Slice Links

## 背景

- `runtime-foundation.md` 把 `P0` 缺口持续收敛在两条线上：`WAITING_CALLBACK` 的 durable resume/operator 排障闭环，以及 sensitive access 的跨入口联动治理。
- 当前项目已经有 run detail、publish invocation detail、callback waiting summary、blocked card 和独立的 `/sensitive-access` inbox，但 inbox 之前主要按 `run_id / status / waiting_status` 粗粒度筛选。
- 这会导致 operator 在 callback waiting、publish drilldown 和 blocked card 里看到审批阻断后，仍然需要再手动去 inbox 二次检索 request/ticket，联合排障链条不够顺。

## 目标

- 让 callback waiting / sensitive access 的关键入口都能直接跳到更细粒度的 inbox slice。
- 把 inbox 的筛选能力从 run 级扩展到 `node_run_id / access_request_id / approval_ticket_id`。
- 保持改动最小，不重做新页面或新治理模型，只增强现有 operator 主链的联动效率。

## 本轮实现

### 1. 后端 sensitive access 列表接口补细粒度筛选

- `api/app/api/routes/sensitive_access.py`
  - `/requests` 新增 `node_run_id`、`access_request_id` 查询参数。
  - `/approval-tickets` 新增 `node_run_id`、`access_request_id`、`approval_ticket_id` 查询参数。
- `api/app/services/sensitive_access_control.py`
  - 把新增筛选参数向 service/query 层透传。
- `api/app/services/sensitive_access_queries.py`
  - `list_access_requests()` 支持按 `node_run_id` 和 request id 过滤。
  - `list_approval_tickets()` 支持按 `node_run_id`、request id 和 ticket id 过滤。

### 2. 前端新增统一 inbox link helper

- 新增 `web/lib/sensitive-access-links.ts`
  - 统一生成 `/sensitive-access` 细粒度 slice 链接。
  - 避免 callback card、timeline list、blocked card、inbox page 自己拼 query，减少后续口径漂移。

### 3. callback / approval / blocked 入口接入直达 inbox slice

- `web/components/callback-waiting-summary-card.tsx`
  - 支持透传 `inboxHref`，在 summary chips 区直接展示 `open inbox slice`。
- `web/components/run-diagnostics-execution/execution-node-card.tsx`
  - callback waiting summary 现在会根据 `node_run_id` + 最新 approval entry 生成定向 inbox slice。
- `web/components/workflow-publish-invocation-callback-section.tsx`
  - published invocation callback drilldown 增加 inbox slice 直达入口。
- `web/components/sensitive-access-blocked-card.tsx`
  - blocked card 直接提供 inbox slice 跳转，不再只停留在 run link。
- `web/components/sensitive-access-timeline-entry-list.tsx`
  - timeline list 改为复用统一 helper，slice 会保留 run/node/request/ticket 级上下文。

### 4. sensitive-access inbox 页面接收细粒度 slice

- `web/app/sensitive-access/page.tsx`
  - 解析并透传 `node_run_id / access_request_id / approval_ticket_id`。
  - 状态 filter 切换时保留当前细粒度 slice。
  - 页面顶部当前 slice strip 会显示 run/node/request/ticket 级命中范围，并支持一键清除 detail slice。
- `web/lib/get-sensitive-access.ts`
  - `getSensitiveAccessInboxSnapshot()` 与底层 fetch helper 同步支持上述筛选参数。

## 验证

- 后端定向：`api/.venv/Scripts/uv.exe run pytest -q tests/test_sensitive_access_routes.py`
  - 结果：`9 passed`
- 后端全量：`api/.venv/Scripts/uv.exe run pytest -q`
  - 结果：`308 passed in 34.37s`
- 前端类型：`web/pnpm exec tsc --noEmit`
  - 结果：通过
- 前端静态检查：`web/pnpm lint`
  - 结果：通过

## 影响评估

- 对用户层：减少从 publish/callback/blocked 状态跳回 inbox 时的人工检索成本。
- 对 AI 与人协作层：callback waiting、approval pending、notification dispatch 的共享事实现在能更快收束到同一个 operator slice。
- 对 AI 治理层：治理入口仍复用现有 `ApprovalTicket / NotificationDispatch` 主链，没有额外引入第二套审批/排障面。

## 下一步

1. 继续把 inbox slice 扩展成可执行的 batch operator 工作面，例如针对单个 `node_run_id` 的批量 approve/retry 视图。
2. 在 run detail / publish detail 内继续补 callback + approval 的 cross-link 解释文案，减少 operator 对字段语义的二次推断。
3. 继续治理 runtime / publish / editor 热点，避免新增联动能力再次堆回大组件或大 helper。
