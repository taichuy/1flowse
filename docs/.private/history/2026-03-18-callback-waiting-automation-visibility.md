# 2026-03-18 callback waiting automation 可见性补强

## 本轮判断

- 当前项目还远未进入“只剩样式整理或人工逐项验收”的阶段。
- `WAITING_CALLBACK` 的后台补偿链路在代码层已经继续推进，但首页 / system overview 还没有把这条事实链直接暴露给 operator。
- 这会让“链路已配置”与“人类可感知、可追踪”之间继续脱节，不利于后续排障与自治开发连续性。

## 本轮改动

1. `api/system/overview`
   - 新增 `callback_waiting_automation` 结构，明确暴露：
     - stale callback ticket cleanup 的周期任务配置
     - due `WAITING_CALLBACK` resume monitor 的周期任务配置
     - 当前是 `configured / partial / disabled` 哪种状态
     - 仍然依赖独立 scheduler 进程这一诚实边界
2. `web/app/page.tsx`
   - 首页新增 callback waiting automation 面板，直接展示背景恢复配置，而不是只在运行细节页或文档里隐含存在。
3. 测试与文档
   - 补 `api/tests/test_system_routes.py`、`api/tests/test_celery_app.py`
   - 更新 `README.md`、`api/README.md`，修正文档里“尚未具备后台自动唤醒”的过时表述

## 验证

- `api/.venv/Scripts/uv.exe run pytest -q tests/test_system_routes.py tests/test_celery_app.py`
- `pnpm exec tsc --noEmit`
- `pnpm lint`
- `git diff --check`（仅有仓库既有 CRLF 提示，无 diff 格式错误）

## 对下一轮的建议

1. P0：继续把 callback waiting / approval pending / notification retry 的 blocker explanation 统一到 run detail、publish detail 与 inbox。
2. P0：继续推进高风险 execution capability / sandbox readiness 在 diagnostics、editor preflight、runtime dispatch 三处共用同一事实模型。
3. P1：考虑把 scheduler 实际心跳或最近一次执行结果接到 system overview，避免当前只能看到“配置已开”，还看不到“进程是否真的在跑”。
