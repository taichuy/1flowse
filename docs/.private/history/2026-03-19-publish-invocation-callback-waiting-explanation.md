# 2026-03-19 publish invocation callback waiting explanation

## 本轮主题

- 沿 `docs/.private/runtime-foundation.md` 的 shared explanation layer 主线，补齐 published invocation detail 的顶层 `callback_waiting_explanation`。
- 避开当前工作区中尚未提交的 sensitive access 脏改动，只推进 publish detail 这条相邻但独立的主链。

## 已完成

- 后端在 `PublishedEndpointInvocationDetailResponse` 增加顶层 `callback_waiting_explanation`。
- published invocation detail 路由优先复用 execution focus node 的 callback waiting 解释；若当前 focus 不提供，则回退到 waiting lifecycle 的解释。
- 前端 publish invocation detail 面板改为优先消费顶层解释，避免 callback waiting 文案口径继续散落在嵌套 waiting lifecycle 上。
- 补充并更新后端测试，覆盖 waiting 场景与非 waiting fallback 场景。

## 验证

- `api/.venv/Scripts/uv.exe run pytest -q tests/test_workflow_publish_routes.py -k published_invocation_detail_drills_into_run_callback_and_cache`
- `api/.venv/Scripts/uv.exe run pytest -q tests/test_published_invocation_detail_access.py -k "requires_approval_for_high_sensitive_runs or surfaces_execution_fallback_explanation"`
- `api/.venv/Scripts/uv.exe run pytest -q`
- `pnpm exec tsc --noEmit`
- `pnpm lint`
- `git diff --check`

## 下一步建议

1. 继续把 publish detail / operator result / action detail 的 waiting 与 governance 解释统一到共享 presenter / response 字段，减少页面各自拼装 copy。
2. 在不碰当前 sensitive access 脏改动的前提下，优先推进 callback waiting 的 action outcome / requeue delta 暴露面。
3. 等当前工作区的 sensitive access 改动稳定后，再考虑把 related detail 页面共享解释层一起收口。
