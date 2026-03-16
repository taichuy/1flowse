# 2026-03-16 operator manual resume actions

## 背景

- `WAITING_CALLBACK` 主线此前已经具备 callback drilldown、approval/blocker 解释、细粒度 inbox slice，以及按 `run_id / node_run_id` 触发的 scoped cleanup。
- 但 operator 在审批已处理、或明确希望立刻重试当前 waiting run 时，仍主要依赖 scheduler/backoff 或先做 cleanup，再回头观察恢复结果。
- 这会让“已能看清阻断”与“能在同一处立即处理阻断”之间继续存在操作落差。

## 目标

- 把手动恢复动作直接接到 callback waiting 卡片。
- 保留 operator 发起恢复时的 `source / reason`，让事件链继续可追溯。
- 保持 scoped cleanup 与 manual resume 并存，避免把不同场景硬塞成单一动作。

## 实现

### 1. 后端 resume 路由补充可追溯输入

- 在 `api/app/schemas/run.py` 新增 `RunResumeRequest`，允许为 `/api/runs/{run_id}/resume` 传入 `source` 与 `reason`。
- 在 `api/app/api/routes/runs.py` 中让 `resume_run` 接收该请求体，并透传给 `RuntimeService.resume_run(...)`。
- 这样 `run.resumed` 事件不再只能写死 `manual_api`，而能区分出 operator callback resume 等人工入口。

### 2. 前端 callback waiting 卡片新增“立即尝试恢复”

- 新增 `web/app/actions/runs.ts`，封装调用 `/api/runs/{run_id}/resume` 的 server action，并统一刷新首页、`/sensitive-access` 与 run detail。
- `web/components/callback-waiting-inline-actions.tsx` 现同时承载两类动作：
  - `立即尝试恢复`
  - `处理过期 ticket 并尝试恢复`
- `web/components/callback-waiting-summary-card.tsx` 在 callback waiting 未终止时展示手动恢复；已终止时则避免继续给出无效恢复入口。

## 影响范围

- 人类 operator 在 run diagnostics 与 published callback drilldown 内，可以更快推进 waiting callback 的恢复闭环。
- AI 与人协作层的共享事实入口继续保持统一：动作仍经由后端主链、事件继续进入 `run_events`，而不是前端临时旁路。
- 当前并未引入新的执行语义，只是把已有 resume 主链拉到 callback operator 面上，并增强其可追溯性。

## 验证

- 后端定向：`cd api; .\.venv\Scripts\uv.exe run pytest -q tests/test_run_routes.py tests/test_run_callback_ticket_routes.py`
  - 结果：`28 passed in 1.49s`
- 后端全量：`cd api; .\.venv\Scripts\uv.exe run pytest -q`
  - 结果：`316 passed in 32.67s`
- 前端类型检查：`cd web; pnpm exec tsc --noEmit`
  - 结果：通过
- 前端 lint：`cd web; pnpm lint`
  - 结果：通过

## 结论与下一步

- 本轮补的是 `WAITING_CALLBACK` 主线里的 operator 恢复动作，不是细枝末节式清理；它直接缩短了“看到阻断 -> 处理阻断 -> 再观察恢复”的路径。
- 下一步优先级仍保持在 callback/approval 的 action suggestion 与更强的 execution isolation，不建议把重点转移到纯 UI 打磨或低价值重构。
