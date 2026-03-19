# 2026-03-16 Published Invocation Export

## 背景

- 用户要求先按 `AGENTS.md` 指定顺序阅读核心文档、理解项目现状、复核最近一次 Git 提交是否需要衔接，再基于优先级继续开发并补记录。
- 复核结果是：基础框架已经足够支撑持续功能开发，最近一次提交 `12354f0 feat: validate workflow publish version references` 继续收紧的是 editor/save-time 治理链，不需要回头补“基础框架”；真正的 P0 缺口仍是 `docs/dev/runtime-foundation.md` 里明确挂起的 publish export 敏感治理。
- 在本轮之前，统一 sensitive access 主链已经接到 credential resolve、context read、tool invoke、run trace export、published invocation detail 和 published cache inventory，但 publish activity 仍停留在“能看列表，不能安全导出”的半闭环状态。

## 目标

1. 为 published endpoint invocation audit 增加真实 export 入口，支持沿当前 filter 导出 JSON / JSONL。
2. 把 publish export 挂到现有统一 sensitive access 主链，而不是另起一套审批逻辑。
3. 让前端 publish governance 面板直接具备下载和阻断反馈入口，避免只有后端路由可用、UI 没有落点。

## 现状判断

### 1. 基础框架是否已经写好

- 结论：**是。** 当前仓库已经具备 workflow / runtime / published surface / trace / governance 的真实骨架，本轮不需要回头“补框架”，而是继续沿已有主链收口能力。

### 2. 最近一次提交是否需要衔接

- 结论：**需要理解，但不必机械延续同一 save-time 子线。** `12354f0` 解决的是 publish version reference 的保存前一致性；本轮选择衔接 `runtime-foundation` 里的 P0 publish governance 缺口，是另一条更高优先级的当前事实主线。

### 3. 架构是否支撑后续功能、扩展性、兼容性、可靠性与安全性

- 结论：**总体支撑。** `7Flows IR`、单一 runtime orchestration owner、published gateway、统一事件流和统一 sensitive access 主链都还成立；当前最需要做的是继续把这些横向治理能力挂到更多真实业务入口，而不是推倒重写。

### 4. 代码热点是否需要继续解耦

- 结论：**需要，但应贴着业务主链做。** 本轮没有让 `published_endpoint_activity.py` 再膨胀出第二套 export 查询逻辑，而是抽出 `PublishedInvocationExportAccessService`、`published_invocation_exports.py`，并让 list/export 复用同一套 response builder。

## 实现

### 1. 后端：补齐 publish activity export 路由

- 在 `api/app/api/routes/published_endpoint_activity.py` 新增：
  - `GET /api/workflows/{workflow_id}/published-endpoints/{binding_id}/invocations/export`
  - 支持沿现有 `status / request_source / request_surface / cache_status / run_status / api_key_id / reason_code / created_from / created_to / limit` 过滤导出
  - 支持 `format=json|jsonl`
- list 与 export 现在复用同一套 `_build_published_endpoint_invocation_list_response()`，避免 route 内复制第二套 audit 组装逻辑。

### 2. 后端：把 publish export 接入统一敏感访问控制

- 新增 `api/app/services/published_invocation_export_access.py`：
  - 基于导出结果里的 `run_id` 集合汇总最高敏感级别
  - 把 publish export 映射到 `workspace_resource` 下的 `published_invocation_export` 资源
  - 复用既有 `SensitiveAccessRequest / ApprovalTicket / NotificationDispatch` 主链，`action_type` 为 `export`
- 高敏 run 命中时，export 入口不再直接出数据，而是返回统一的 `403/409 sensitive access blocked` 结构化响应。

### 3. 后端：统一 export payload / filename / JSONL 序列化

- 新增 `api/app/services/published_invocation_exports.py`：
  - 统一导出文件名
  - 统一 JSON 顶层结构：`export + binding + filters + summary + facets + items`
  - 统一 JSONL 结构：首行 export/meta，后续逐条 invocation record

### 4. 前端：publish governance 面板接上导出入口

- 新增 `web/components/workflow-publish-export-actions.tsx`：
  - 复用和 run trace export 相同的下载 / blocked-card 交互模式
  - 默认导出当前 filter 下最多 200 条 invocation
  - 命中审批时直接展示 `SensitiveAccessBlockedCard`
- `WorkflowPublishActivityPanel` 现已展示导出按钮，不再需要用户手工拼导出 URL。
- `web/lib/get-workflow-publish.ts` 增加 publish invocation export URL builder，并把 invocation list / export 的 query 构造统一到同一 helper。
- `web/lib/workflow-publish-governance.ts` 把 publish time-window 解析与时间范围换算收口为共享 helper，避免 page 与导出组件重复维护时间窗口语义。

## 影响范围

- `api/app/api/routes/published_endpoint_activity.py`
- `api/app/services/published_invocation_export_access.py`
- `api/app/services/published_invocation_exports.py`
- `api/tests/test_workflow_publish_activity.py`
- `web/components/workflow-publish-export-actions.tsx`
- `web/components/workflow-publish-activity-panel.tsx`
- `web/lib/get-workflow-publish.ts`
- `web/lib/workflow-publish-governance.ts`
- `web/app/workflows/[workflowId]/page.tsx`
- `docs/dev/runtime-foundation.md`

## 验证

### 后端静态检查

在 `api/` 目录执行：

```powershell
.\.venv\Scripts\uv.exe run ruff check app/api/routes/published_endpoint_activity.py app/services/published_invocation_export_access.py app/services/published_invocation_exports.py tests/test_workflow_publish_activity.py
```

结果：

- 通过

### 后端测试

在 `api/` 目录执行：

```powershell
.\.venv\Scripts\uv.exe run pytest -q tests/test_workflow_publish_activity.py tests/test_published_invocation_detail_access.py
.\.venv\Scripts\uv.exe run pytest -q
```

结果：

- 局部：`10 passed`
- 全量：`271 passed`

### 前端验证

在 `web/` 目录执行：

```powershell
pnpm exec tsc --noEmit
pnpm lint
```

结果：

- `pnpm exec tsc --noEmit`：通过
- `pnpm lint`：通过（带现有 Next.js `next lint` 弃用提示，不影响本轮正确性）

## 结论与下一步

- 当前项目已经具备继续达成产品设计目标的基础框架；本轮工作进一步证明问题不在“架构没搭好”，而在于持续把统一治理能力接到真实业务入口。
- publish activity export 现已从“缺失入口”补成“后端可导出 + 前端可下载 + 敏感时可审批”的真实闭环，和 run trace export、published detail、cache inventory 形成一致治理语义。
- 当前仍**未进入**“只剩人工逐项界面设计/验收”的阶段，因此本轮**不触发** `node "e:\code\taichuCode\ai-presson-wen\aionui\notice\kill-port-8050.js"`。
- 下一步建议按优先级继续：
  1. **P0**：补真实通知 worker / inbox，把 approval/notification 从事实层推进到真正可操作的人工收件箱。
  2. **P0**：继续收口 `WAITING_CALLBACK` 的 published drilldown、operator 入口和回调排障面。
  3. **P1**：补 publish approval timeline / security decision summary，把当前 blocked-card 继续升级成更完整的治理视图。
  4. **P1**：继续治理 `workspace_starters.py`、`agent_runtime_llm_support.py`、`run_views.py` 等热点文件，保持结构演进速度跟得上功能推进速度。
