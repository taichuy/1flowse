# 2026-03-19 operator focus evidence cards

## 本轮主题

- 沿 `docs/.private/runtime-foundation.md` 的 graded execution / shared explanation layer 主线，继续把 compact `run_snapshot` 里的 tool-call 级执行证据接入 operator 结果页。
- 目标不是做样式整理，而是减少 operator 在审批结果、通知重试、手动恢复、callback cleanup、批量治理之后还要跳回 run detail 才能看清 backend / runner / fallback / raw_ref 的断层。

## 已完成

- `web/lib/operator-inline-action-feedback.ts`
  - 把 compact `run_snapshot` 适配成 execution focus explainable node，复用现有 execution focus presenter 生成 tool-call badge / detail 与 artifact summary。
  - inline action feedback model 现在除了 headline / counts，还会携带 `focusToolCallSummaries`、`focusArtifactSummary` 与 `focusArtifacts`。
- `web/components/operator-focus-evidence-card.tsx`
  - 新增轻量共享卡片，用统一 UI 展示 focused tool execution 的 tool-call badge、detail、raw_ref 与 artifact sample。
- `web/components/inline-operator-action-feedback.tsx`
  - 单条 operator action（审批、通知重试、手动恢复、callback cleanup）现在能直接展示 compact snapshot 里的 focused tool execution evidence。
- `web/lib/sensitive-access-bulk-result-presenters.ts`
  - 批量治理结果的 sampled run card 不再只停在聚合计数，也会回带 focused tool execution evidence。
- `web/components/sensitive-access-bulk-governance-card.tsx`
  - 批量治理卡片里的 sampled run 现在直接展示 backend / runner / content type / raw_ref 等 evidence，减少回跳 run detail 的必要性。
- `web/lib/operator-inline-action-feedback.test.ts`
  - 补测试锁住 compact snapshot evidence 到 inline feedback model 的映射，同时保留原有结构化反馈断言。
- `web/lib/sensitive-access-bulk-result-presenters.test.ts`
  - 补测试锁住 sampled run card 会带回 tool-call 详情、artifact summary 与 artifact sample。

## 验证

- `web/pnpm exec vitest run lib/operator-inline-action-feedback.test.ts lib/sensitive-access-bulk-result-presenters.test.ts`
- `web/pnpm exec tsc --noEmit`
- `web/pnpm lint`

## 为什么做这轮

- 最近几轮已经把 `run_snapshot` / `run_follow_up` 的 compact focus evidence 接回后端 canonical facts，但 operator 结果页大多仍只显示 headline 和 counts，tool-call 级执行证据没有继续下沉到动作反馈。
- 这轮补的是 AI 与人协作层、运行基础 / 强隔离主线之间的一个真实断层：如果 operator 做完动作后仍看不到 backend / runner / raw_ref，就会重新退回“去 run detail 里人工二次拼上下文”的旧路径。

## 下一步建议

1. 继续把同一份 compact focus evidence 推进到更多 action detail / follow-up 页面，尤其是仍只显示聚合状态分布的入口。
2. 评估是否要把 compact snapshot 再补一层更结构化的 tool execution trace summary，减少前端继续从 summary 字符串里提炼关键信号。
3. 若 publish / operator 入口继续加厚，可考虑把 shared evidence card 再抽成更通用的 operator evidence section，避免多处重复摆放相同卡片。
