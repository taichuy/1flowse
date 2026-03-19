# 2026-03-19 manual resume operator outcome explanation

## 本轮结论

- `manual resume` 原先仍由 `web/app/actions/runs.ts` 在前端本地拼接结果文案，不符合当前 runtime / operator 结果解释继续下沉后端事实链的方向。
- 本轮把 `/api/runs/{run_id}/resume` 从仅返回 `RunDetail`，扩成返回：
  - `run`
  - `outcome_explanation`
  - `run_follow_up`
- 新增 `api/app/services/run_action_explanations.py`，把手动恢复后的状态口径（waiting / running / succeeded / failed）统一收口到后端。
- 前端 action 现在优先消费后端 `outcome_explanation`，仅在缺字段时退回本地 fallback 文案。

## 已完成验证

- `api/.venv/Scripts/python.exe -m pytest -q api/tests/test_run_routes.py`
- `api/.venv/Scripts/python.exe -m ruff check api/app/api/routes/runs.py api/app/schemas/run.py api/app/services/run_action_explanations.py api/tests/test_run_routes.py`
- `api/.venv/Scripts/python.exe -m pytest -q`（在 `api/` 目录）
- `pnpm exec tsc --noEmit`（在 `web/` 目录）
- `pnpm lint`（在 `web/` 目录）

## 下一步建议

1. 继续把 `run callback / manual resume / callback cleanup / sensitive access action` 的 operator result 统一到同一组后端 explanation builder，减少前端残留 fallback copy。
2. 把 `publish invocation detail`、`run detail` 与 `operator inbox` 的 action result toast / inline message 继续对齐到同一份 shared explanation contract。
3. 若后续增加更多 operator action，优先复用 `run_follow_up` + `outcome_explanation` 组合，不再新增页面本地拼装结果口径。
