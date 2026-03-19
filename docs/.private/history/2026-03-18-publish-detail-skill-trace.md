# 2026-03-18 发布详情 skill trace 补齐

## 本轮判断

- 当前仓库还没有进入只剩样式 polish 或人工验收阶段。
- `WAITING_CALLBACK` 与 graded execution 都已有连续推进，近期提交也集中在 callback blocker follow-up。
- 更直接影响主链完整度的缺口是：`published invocation detail` 还看不到 `agent.skill.references.loaded` 事实，外部调用排障链在 publish surface 断了一截。

## 本轮动作

- 为 `PublishedEndpointInvocationDetailResponse` 增加 `skill_trace` 结构，支持区分 `blocking_node_run` 与 `run` 两种 scope。
- 在后端详情路由里基于 `RunEvent(agent.skill.references.loaded)` 聚合 skill reference load，并优先聚焦阻塞节点。
- 在前端 publish detail 中新增 Skill trace 区块，直接展示 phase/source 摘要和节点级 injected references。
- 抽出 `web/components/skill-reference-load-list.tsx`，让 run detail 与 publish detail 复用同一份渲染逻辑。

## 验证

- `api/.venv/Scripts/python.exe -m pytest api/tests/test_published_invocation_detail_access.py`
- `pnpm exec tsc --noEmit`（`web/`）

## 下一步建议

1. 继续把 published detail / operator 入口补齐 skill request trace，不只展示 loaded references。
2. 继续推进 graded execution，让 publish detail 也能解释 execution blocked / unavailable 的 sandbox 事实。
3. 继续把 callback blocker、skill trace、sensitive access timeline 汇成统一的跨入口 explanation model。
