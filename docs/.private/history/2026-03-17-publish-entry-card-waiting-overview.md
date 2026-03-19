# 2026-03-17 Publish entry card waiting overview

## 背景

- 最近几轮已经把 `P0 WAITING_CALLBACK` 主线上的 `CallbackWaitingSummaryCard`、published callback drilldown、callback ticket row presenter 与 bulk blocker summary 收口到共享 presenter。
- 但 `web/components/workflow-publish-invocation-entry-card.tsx` 仍在列表卡片里手工拼接 `scheduled resume`、`callback lifecycle` 和 waiting 描述，导致 publish activity 首屏与 detail panel 使用的事实模型和 operator 语言不一致。
- 这会让 operator 在列表里只能看到一套简化文案，必须再点进 detail panel 才能切回当前主链已经稳定下来的 blocker / lifecycle 解释。

## 目标

- 让 publish activity 列表里的 invocation entry card 也接入共享 callback presenter。
- 把 waiting headline、blocker rows、scheduled resume 与 callback lifecycle 的表达拉回同一套 operator 事实模型。
- 补一个无需进入 detail panel 的 waiting inbox slice 入口，减少首屏排障跳转成本。

## 实现

- 在 `web/components/workflow-publish-invocation-entry-card.tsx` 中移除了局部的 `formatScheduledResume` 和 `formatCallbackLifecycle` 手工拼接逻辑。
- 改为复用 `web/lib/callback-waiting-presenters.ts` 中的共享能力：
  - `formatScheduledResumeLabel`
  - `formatCallbackLifecycleLabel`
  - `getCallbackWaitingHeadline`
  - `listCallbackWaitingBlockerRows`
  - `listCallbackWaitingChips`
- 通过 `web/lib/published-invocation-presenters.ts` 的 `buildPublishedInvocationInboxHref` 为 entry card 增加 `open waiting inbox` 入口；即使列表项只拿到聚合 waiting lifecycle，也能直接打开与当前 invocation 对应的 inbox slice。
- 同时把列表卡里的 `Run status` 改为复用 `formatPublishedRunStatusLabel`，避免 publish activity 首屏继续暴露生硬的原始状态值。

## 影响范围

- publish activity 列表首屏现在就能看到统一的 waiting overview，而不是只在 detail panel 中才有结构化 blocker 解释。
- `WAITING_CALLBACK` 主线的共享 presenter 从 callback summary / publish detail / execution node card 继续扩展到 publish activity entry card，减少 operator 在不同入口间切换时的信息编排差异。
- 这属于主链闭环推进，而不是局部美化：它直接缩短了 operator 从“发现 waiting invocation”到“定位下一步动作”的路径。

## 验证

- `web/pnpm exec tsc --noEmit`
- `web/pnpm lint`

## 下一步

- 继续检查 publish activity 其余 overview / insight 入口是否还残留 waiting / ticket 的手工文案拼接。
- 若仍有分叉，继续复用同一套 presenter / section helper 收口，而不是再新增一套 publish-only 解释层。
