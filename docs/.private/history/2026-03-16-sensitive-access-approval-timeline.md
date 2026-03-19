# 2026-03-16 Sensitive Access Approval Timeline

## 背景

- 用户要求先系统阅读 `AGENTS.md`、`docs/dev/user-preferences.md`、`docs/product-design.md`、`docs/technical-design-supplement.md`、`docs/dev/runtime-foundation.md`，再结合最近一次 Git 提交判断项目现状、基础框架是否成立，以及是否需要继续衔接最近主线开发。
- 复核最近提交链后，结论是：`7f8c516 feat: add sensitive access notification retry`、`3c61ae7 feat: add sensitive access inbox` 仍在推进统一敏感访问治理主线，不需要回头重写底座；当前更值得继续衔接的是把审批 / 通知事实层真正接到 run diagnostics 与 published detail，而不是只停留在 inbox 和 blocked-card。
- 本轮评估也确认：项目基础框架已经满足继续做功能性开发，不需要停下来返工架构；当前更真实的风险是若 run diagnostics / publish detail 看不到审批时间线，operator 仍需要在 run 页面、publish 页面和 inbox 之间来回跳转，治理事实存在但排障体验割裂。

## 现状判断

### 1. 上一次 Git 提交是否需要衔接

- 结论：**需要继续衔接。** `7f8c516` 已让通知通道具备诚实失败语义与最小 retry 入口，但 operator 仍缺少“在 run / published detail 里直接看到审批轨迹”的诊断落点；本轮顺着这条主线补齐 approval timeline，而不是另开新方向。

### 2. 基础框架是否已经写好

- 结论：**是。** 当前仓库已经具备 workflow / runtime / published surface / trace / sensitive access 的统一事实层，足以支撑继续做产品主业务，不需要停下来重构 `7Flows IR` 或执行主链。

### 3. 架构是否满足扩展性、兼容性、可靠性、安全性

- 结论：**总体满足。** 本轮没有引入新的流程控制语义，也没有让 run diagnostics 或 published detail 发明第二套安全模型；审批时间线完全复用 `SensitiveAccessRequest / ApprovalTicket / NotificationDispatch` 既有事实层。
- 后端把时间线查询与序列化拆到 `api/app/services/sensitive_access_timeline.py` 与 `api/app/services/sensitive_access_presenters.py`，避免 `run_views.py`、published detail route 和 `/api/sensitive-access/*` 路由各自再写一套资源 / request / ticket / notification 拼装逻辑。
- 前端用共享的 `web/components/sensitive-access-timeline-entry-list.tsx` 同时服务 run diagnostics 和 published detail，避免 execution node card 与 publish detail panel 再各自长出一份不一致的 operator UI。

### 4. 当前仍需关注的结构热点

- 后端热点仍包括：`api/app/services/runtime_node_dispatch_support.py`、`api/app/services/agent_runtime_llm_support.py`、`api/app/services/workspace_starter_templates.py`、`api/app/services/run_views.py`。
- 前端热点仍包括：`web/components/workflow-editor-workbench/use-workflow-editor-graph.ts`、`web/components/workflow-editor-workbench.tsx`、`web/lib/get-workflow-publish.ts`。
- 本轮没有优先重构这些文件，是因为 `P0/P1` 的交叉收益更高：先把 approval timeline 接到真实排障入口，能直接提高当前主业务的完整度与治理可见性。

## 目标

1. 把 node-scoped 的敏感访问审批轨迹直接暴露到 run diagnostics execution view。
2. 把同一套审批轨迹直接暴露到 published invocation detail，减少 operator 在 publish detail、run detail 与 inbox 之间来回跳转。
3. 在不破坏现有 runtime / published surface 边界的前提下，顺手收敛敏感访问时间线的 presenter / query helper，降低继续扩展 operator 视图时的重复成本。

## 实现

### 1. 后端新增敏感访问 timeline / presenter 辅助层

- 新增 `api/app/services/sensitive_access_presenters.py`：统一序列化 `SensitiveResource`、`SensitiveAccessRequest`、`ApprovalTicket`、`NotificationDispatch` 以及 timeline entry。
- 新增 `api/app/services/sensitive_access_timeline.py`：集中负责按 run 读取 node-scoped 敏感访问 bundle，并聚合 decision / approval / notification summary。
- `api/app/api/routes/sensitive_access.py` 改为复用 presenter，而不是在 route 文件里重复维护一套 item serializer。

### 2. Run diagnostics execution view 接入 approval timeline / security summary

- 更新 `api/app/schemas/run_views.py`、`api/app/services/run_views.py`：
  - `RunExecutionSummary` 新增敏感访问 request / approval / notification 计数与状态分布。
  - `RunExecutionNodeItem` 新增 `sensitive_access_entries`，直接挂 node-scoped 的审批轨迹。
- 更新 `web/lib/get-run-views.ts`、`web/components/run-diagnostics-execution/execution-overview.tsx`、`web/components/run-diagnostics-execution/execution-node-card.tsx`：
  - execution overview 现在能看到敏感访问 request / approval / notification summary。
  - execution node card 现在能直接展示 resource、decision、approval ticket、notification delivery 的时间线，而不只剩 callback ticket。

### 3. Published invocation detail 接入同一套 approval timeline

- 更新 `api/app/schemas/workflow_publish.py` 与 `api/app/api/routes/published_endpoint_invocation_detail.py`：published detail 响应新增 `sensitive_access_entries`，直接返回 run 内 node-scoped 的审批轨迹。
- 更新 `web/lib/get-workflow-publish.ts` 与 `web/components/workflow-publish-invocation-detail-panel.tsx`：published detail panel 直接展示 approval timeline，让 publish-surface 排障与 run diagnostics 使用同一套 operator 视图。

### 4. 前端共享组件复用

- 新增 `web/components/sensitive-access-timeline-entry-list.tsx`，避免 run diagnostics 与 published detail 各写一套敏感访问卡片。
- 更新 `web/components/run-diagnostics-execution-sections.tsx` 文案，使“Execution Timeline” 明确包含 approvals / security decisions，而不是只提 artifacts / tool calls / callback lifecycle。

## 验证

### 后端针对性测试

在 `api/` 目录执行：

```powershell
.\.venv\Scripts\uv.exe run pytest -q tests/test_run_view_routes.py tests/test_workflow_publish_routes.py
```

结果：`26 passed`

### 后端全量测试

在 `api/` 目录执行：

```powershell
.\.venv\Scripts\uv.exe run pytest -q
```

结果：`273 passed`

### 前端静态校验

在 `web/` 目录执行：

```powershell
pnpm lint
pnpm exec tsc --noEmit
```

结果：通过；`next lint` 额外提示其在 Next.js 16 废弃，但本轮无 ESLint 错误。

### 差异检查

在仓库根目录执行：

```powershell
git diff --check
```

结果：无空白错误；仅提示若干文件会在 Git 触碰时把 `LF` 归一为 `CRLF`，属于当前工作区换行告警，不是本轮逻辑错误。

## 结论与下一步

- 当前项目依然**没有进入**“只剩人工逐项界面设计 / 全链路人工验收”的阶段，因此本轮**不触发** `node "e:\code\taichuCode\ai-presson-wen\aionui\notice\kill-port-8050.js"`。
- 本轮确认：项目基础框架已经足够支撑继续推进产品设计要求，当前更应该做的是沿既有事实层持续补 operator 可见性、治理闭环和执行隔离，而不是返工底座。
- 下一步建议按优先级继续：
  1. **P0**：补真实 `notification worker / adapter`，把当前 approval timeline 上的通知状态从“诚实失败 + 手动 retry”推进到可自动投递。
  2. **P0**：继续补 timeline 的 drilldown / filter / cross-link，把 inbox、run diagnostics、published detail 三个入口串成完整 operator 控制面。
  3. **P0**：继续把 graded execution 从 execution-aware 推到真实隔离能力，优先补 `sandbox / microvm` tool adapter 与 compat plugin execution boundary。
  4. **P1**：继续治理 `runtime_node_dispatch_support.py`、`agent_runtime_llm_support.py`、`workflow-editor-workbench/use-workflow-editor-graph.ts` 等结构热点，避免功能推进快于解耦节奏。
