# 2026-03-19 publish activity canonical follow-up

## 本轮主题

- 延续 `docs/.private/runtime-foundation.md` 中 publish / shared explanation 主线，把 `published invocation detail` 已有的 canonical `run_follow_up` 下沉到 activity list / entry card。
- 目标不是做列表样式整理，而是让 publish activity 在不点进 detail 的前提下，也能直接给出“当前最该跟进什么”的统一事实口径。

## 已完成

- `api/app/services/operator_run_follow_up.py`
  - 新增批量 `build_operator_run_follow_up_summary_map`，复用共享 run / node_run / execution view 读取，避免 list 路径为每条 invocation 单独重复查询。
- `api/app/api/routes/published_endpoint_activity.py`
  - invocation list 现在为带 `run_id` 的 item 注入 canonical `run_follow_up`，并保持无 run 的 rejected 记录返回 `null`。
- `api/app/api/routes/published_endpoint_invocation_support.py`
  - `serialize_published_invocation_item` 支持注入 `run_follow_up_lookup`。
- `api/app/schemas/workflow_publish.py`
  - `PublishedEndpointInvocationItem` 增加 `run_follow_up`，让 publish activity list 与 detail 共用同一条 follow-up 契约。
- `web/lib/workflow-publish-types.ts`
  - 同步前端类型。
- `web/components/workflow-publish-invocation-entry-card.tsx`
  - 新增 `Canonical follow-up` 区块，直接展示后端 explanation 与状态摘要，不再只靠 waiting 专项文案。
- `api/tests/test_workflow_publish_routes.py`
  - 补 waiting invocation list 的 `run_follow_up` 断言，并覆盖 rejected invocation 的 `null` 路径。

## 验证

- `./api/.venv/Scripts/python.exe -m pytest api/tests/test_workflow_publish_routes.py -q`
- `pnpm -C web exec tsc --noEmit`
- `git diff --check`

## 为什么做这轮

- 这轮继续推进 publish 侧“共享解释层”主链，而不是局部 polish。
- detail 已经有 canonical follow-up，但 activity list 仍要求用户点进详情才能看到下一步动作，造成发布入口与 operator 入口之间的信息断层。
- 把 `run_follow_up` 前移到列表后，publish activity 能更直接承接 waiting / blocked / succeeded 等不同状态下的 follow-up 判断。

## 下一步建议

1. 继续把 publish activity filters / facets / summary 也对齐 canonical follow-up，减少只看聚合统计却看不到下一步动作的断层。
2. 回到 `graded execution` 主线，继续评估 native / compat tool 的真实 sandbox runner 落点，而不是让强隔离长期停在 fail-closed。
3. 若 publish / sensitive access / run detail 后续继续共享相同解释层，可再把前端 `follow-up` 展示抽成更稳定的共享组件。
