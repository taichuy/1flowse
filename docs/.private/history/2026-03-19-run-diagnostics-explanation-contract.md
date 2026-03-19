# 2026-03-19 run diagnostics explanation contract

## 本轮判断

- 当前项目仍处于主链闭环推进期，不是只剩样式整理或人工验收阶段。
- 结合 `docs/.private/runtime-foundation.md` 的 P0/P1 和最近提交，最值得继续推进的是 shared explanation contract，而不是局部 polish。
- 前端勘探发现 `run diagnostics` 仍在 execution node card / blocker list 里自己生成 execution explanation，是当前最明显的口径分叉。

## 本轮落地

- 给 `RunExecutionNodeItem` 增加 `execution_focus_explanation`。
- 后端 `run_execution_views` 在构建每个 node item 时直接挂 canonical explanation。
- `run diagnostics` 的 node card / blocker list 改为优先消费后端 explanation，只保留前端 presenter 作为兜底。
- 补了 execution-view 相关后端断言，并通过 targeted pytest + web tsc。

## 下一步建议

1. 继续把 `run diagnostics` 其他 execution-related copy 收口到 shared contract，逐步缩小 `run-execution-focus-presenters.ts` 的职责。
2. 检查 `sensitive-access inbox` / `publish invocation detail` 里仍保留的 fallback presenter，评估是否也能由后端补齐 node-level explanation 后继续下沉。
3. 如果要继续走 P0 主线，可优先转向 `WAITING_CALLBACK` operator result 页面，减少 action 侧 message 拼装对 snapshot fallback 的依赖。
