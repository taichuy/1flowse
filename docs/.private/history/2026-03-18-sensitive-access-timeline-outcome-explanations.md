# 2026-03-18 sensitive access timeline outcome explanations

## 本轮主题

- 把 sensitive access timeline entry 的 operator outcome explanation 下沉到后端事实层，并在 run diagnostics / publish detail 共用组件中直接展示。
- 顺手修复全量 pytest 暴露的 `WAITING_CALLBACK` legacy `scheduled_resume` monitor 兼容问题，避免旧 payload 因缺少 `scheduled_at / due_at` 而被错误跳过。

## 已完成事实

- `api/app/services/sensitive_access_action_explanations.py`
  - 新增 `build_sensitive_access_timeline_outcome_explanation()`。
  - 对 pending / approved / rejected / expired / allow / deny / require_approval-no-ticket 等状态给出统一 `primary_signal + follow_up`。
- `api/app/services/sensitive_access_presenters.py`
  - timeline entry 序列化时直接带上 `outcome_explanation`，让 run detail 与 publish detail 共用同一份后端解释事实。
- `api/app/schemas/sensitive_access.py`
  - `SensitiveAccessTimelineEntryItem` 新增 `outcome_explanation`。
- `web/components/sensitive-access-timeline-entry-list.tsx`
  - 直接展示 timeline entry 的共享 outcome explanation，避免页面各自写一套 copy。
- `api/app/services/waiting_resume_monitor.py`
  - legacy `scheduled_resume` 缺少 `scheduled_at / due_at` 时，monitor 改为按当前扫描窗口视为 overdue，而不是回退到宿主实时时钟导致误判未来。

## 验证

- `api/.venv/Scripts/uv.exe run pytest -q tests/test_waiting_resume_monitor.py tests/test_run_view_routes.py tests/test_workflow_publish_routes.py`
- `api/.venv/Scripts/uv.exe run pytest -q`
- `web/pnpm exec tsc --noEmit`
- `web/pnpm lint`

## 对下一轮的意义

- run diagnostics / publish detail / sensitive access inbox 之间的解释模型继续向同一条 operator follow-up 事实链收口。
- `WAITING_CALLBACK` 的 durable resume 主链又补掉一处 legacy 兼容洞，避免 scheduler monitor 对旧 checkpoint 产生静默遗漏。

## 下一步建议

1. 继续把 publish detail / run detail 中的 blocker delta 与 action detail 下沉为统一后端解释，而不是让页面继续各自拼接。
2. 继续补 sensitive access timeline 的 run snapshot / inline action result 对齐，减少 operator 在 inbox、run、publish 三处切换时的语义漂移。
3. 沿 `WAITING_CALLBACK` 主链继续排查还有没有 legacy payload / event 兼容洞，特别是 cleanup / retry / late callback 交界处。
