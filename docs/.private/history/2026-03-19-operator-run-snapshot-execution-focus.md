# 2026-03-19 operator run snapshot execution focus

## 本轮主题
- 把 operator run snapshot / run follow-up 接到 canonical execution focus explanation，而不是只返回 status / waiting_reason。
- 让 sensitive access 动作结果优先消费 backend execution focus explanation，减少 operator 侧再拼一层临时文案。

## 已完成
- `api/app/schemas/operator_follow_up.py` 为 run snapshot 增加 `execution_focus_reason`、`execution_focus_node_id`、`execution_focus_node_run_id`、`execution_focus_explanation`。
- `api/app/services/operator_run_follow_up.py` 复用 `RunViewService` 为单 run snapshot 与 sampled runs 注入 canonical execution focus。
- 补了 `api/tests/test_operator_run_follow_up.py` 的 waiting / fallback 两类场景。
- 更新 `api/tests/test_sensitive_access_routes.py`，让审批/通知动作响应显式断言新的 snapshot contract。
- `web/app/actions/sensitive-access.ts` 与 `web/lib/operator-action-result-presenters.ts` 开始消费 backend execution focus explanation。
- 新增 `web/lib/operator-action-result-presenters.test.ts`，锁住“优先展示 canonical focus，避免只回落 waiting reason”。

## 验证
- `python -m pytest api/tests/test_operator_run_follow_up.py api/tests/test_sensitive_access_routes.py api/tests/test_run_execution_focus_explanations.py api/tests/test_run_routes.py api/tests/test_published_invocation_detail_access.py -q`
- `pnpm test -- operator-action-result-presenters.test.ts callback-blocker-follow-up.test.ts run-execution-focus-presenters.test.ts`

## 下一步建议
1. 继续把 `fetchRunSnapshot` / 其他 operator 入口也切到同一份 canonical execution focus，减少前端再读 run detail 自行推断。
2. 评估是否把 bulk run follow-up summary 继续下沉更多 blocker delta / action detail，而不是只传 sampled runs。
3. 继续沿当前 `P0/P1` 主线推进 published detail、operator result、inbox slice 的共享解释层收口。
