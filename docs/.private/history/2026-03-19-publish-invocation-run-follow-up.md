# 2026-03-19 publish invocation detail 接入 run follow-up

## 本轮结论

- 本轮没有继续做 editor 局部 polish，而是继续沿 runtime / publish 的共享解释层推进。
- `published invocation detail` 现在直接挂上后端 canonical `run_follow_up`，把发布入口的排障路径接到已有的 operator follow-up 事实链。
- 这样从 publish detail 就能直接看到受影响 run 的状态分布、样本快照和 follow-up 解释，不必再只靠局部 waiting / execution 片段自行拼接下一步动作。

## 代码落点

- 后端：`api/app/api/routes/published_endpoint_invocation_detail.py`
  - 响应增加 `run_follow_up`，复用 `build_operator_run_follow_up_summary`。
- Schema：`api/app/schemas/workflow_publish.py`
  - `PublishedEndpointInvocationDetailResponse` 增加 `run_follow_up`。
- 前端：`web/lib/workflow-publish-types.ts`
  - 增加 publish detail 所需的 run follow-up 类型。
- 前端：`web/components/workflow-publish-invocation-detail-panel.tsx`
  - 新增 `Canonical follow-up` 区块，直接展示后端 explanation 与状态摘要。
- 测试：
  - `api/tests/test_workflow_publish_routes.py`
  - `api/tests/test_published_invocation_detail_access.py`

## 验证

- `./api/.venv/Scripts/python.exe -m pytest api/tests/test_workflow_publish_routes.py api/tests/test_published_invocation_detail_access.py`
- `pnpm -C web exec tsc --noEmit`

## 下一步建议

1. 继续把 publish activity list / invocation entry card 也接上同一条 canonical follow-up，减少必须点进 detail 才能判断下一步动作。
2. 若 publish detail 后续还要承载更多 operator 场景，可考虑把 run snapshot / follow-up 类型从 `sensitive-access`、`publish` 等页面继续收口成共享前端类型。
3. 再往后优先回到 graded execution 主链，继续清理剩余高风险执行路径的 blocker 解释是否完全统一。
