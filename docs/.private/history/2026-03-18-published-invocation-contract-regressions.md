# 2026-03-18 published invocation contract regressions

## 本轮判断

- 当前仓库仍处于主链持续加厚阶段，不是只剩样式整理；本轮优先修的是 published invocation 相关验证基线，而不是局部 UI 润色。
- `published invocation detail` 的等待态契约已经演进出 `sensitive_access_summary`，但 `api/tests/test_workflow_publish_routes.py` 的路由级回归测试没有同步，导致全量后端验证存在既有红灯。
- 同文件里关于 invocation activity 列表的 `cache_status` 顺序断言还把“状态序列”误当成稳定契约，忽略了真正需要锁住的是 `created_at` 降序和状态计数。

## 本轮实现

1. `api/tests/test_workflow_publish_routes.py`
   - 为 `test_get_published_invocation_detail_drills_into_run_callback_and_cache` 补上 `run_waiting_lifecycle.sensitive_access_summary` 断言，明确锁住 published detail 已对外暴露的敏感访问治理摘要。
   - 把 invocation activity 列表的脆弱顺序断言改成两层契约：
     - `cache_status` 计数保持 `2 miss + 1 hit`
     - `items.created_at` 必须按降序返回
2. 验证
   - 先跑 published detail 相关定向 pytest，确认等待态 detail/support 套件回归通过。
   - 再跑 `api/.venv/Scripts/uv.exe run pytest -q`，确认后端全量恢复为绿。

## 结果

- 本轮没有新增共享规则，因此未更新 `AGENTS.md` / `docs/dev/team-conventions.md` / ADR。
- 当前后端全量 pytest 已恢复为 `396 passed`，published invocation detail / activity 的验证基线重新可信。

## 下一步建议

1. P0：继续把 published/operator 入口与 runtime 一致的 blocker explanation 锁进更多路由级回归，避免 detail/UI 已演进但端到端测试口径掉队。
2. P0：回到 `WAITING_CALLBACK` durable resume 主线，优先补强 callback waiting / approval pending / notification retry 的跨入口统一 follow-up。
3. P1：若后续 published activity 继续扩字段，优先在 presenter / route 双层都加回归，避免再次出现“实现已变、旧测试仍假设旧契约”。
