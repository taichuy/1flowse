# 2026-03-18 execution blocker explanation

## 本轮完成

- 把 `run diagnostics` 的 priority blockers 从 `callback waiting` 条件中解耦，execution blocked / unavailable 节点即使没有 callback waiting 也会进入 overview。
- 新增 `web/lib/run-execution-blockers.ts`，把 blocker 选择逻辑抽成可复用、可测试的纯函数。
- 加厚 `web/lib/run-execution-focus-presenters.ts`，针对 `inline` 强隔离错配、缺失 sandbox backend、compat/native tool execution class 不支持、backend capability 不兼容等阻断原因输出更具体的中文解释与 follow-up。
- `execution-node-card` 现在复用同一套 execution focus presenter，节点时间线和 publish / overview 不再各说各话。
- 补齐 `RunCallbackWaitingSummary.scheduled_resume_requeued_node_count` 的前端类型漂移，并同步旧测试夹具。

## 验证

- `web/pnpm test`
- `web/pnpm exec tsc --noEmit`
- `web/pnpm lint`

## 下一步建议

1. 继续把同一套 blocker explanation 下沉到后端结构化字段，减少前端靠字符串规则识别的比例。
2. 把 publish detail / sensitive access inbox 中的 blocker 技术细节进一步结构化展示，例如 capability mismatch 的具体项。
3. 继续沿 `runtime-foundation` 的 P0，把 graded execution 的 blocker explanation 扩到 runtime dispatch / published invocation detail 的统一事实链。
