# 2026-03-16 Published callback drilldown refactor

## 背景

- `docs/dev/runtime-foundation.md` 已把 `WAITING_CALLBACK` 的下一阶段重点收敛到 published callback drilldown、callback / approval 联合排障解释，以及 publish detail 聚合热点继续拆层。
- `web/components/workflow-publish-invocation-detail-panel.tsx` 在补齐 callback waiting explanation 后，仍同时承担 run drilldown、cache drilldown、callback ticket 列表和 approval timeline，多块 operator 语义继续堆在一个面板里，不利于后续沿 published waiting surface 持续补细节。
- 当前项目尚未进入“只剩人工界面设计”的阶段，因此本轮继续按 runtime-foundation 的 P0/P1 主线推进 publish callback operator 闭环，而不触发人工验收通知脚本。

## 目标

1. 继续增强 published invocation detail 对 callback waiting 的 operator drilldown 能力。
2. 把 callback lifecycle / approval blockers / ticket list 从 detail 面板壳层拆成独立 section，降低后续继续补 explanation 时的耦合。
3. 让 published surface 更直接回答“现在为什么还没恢复、最近一次 ticket/late callback 发生了什么、下一步该从哪里排障”。

## 实现

### 1. 新增独立 callback section

- 新增 `web/components/workflow-publish-invocation-callback-section.tsx`。
- 该 section 统一承接：
  - callback waiting summary card；
  - resume blockers 摘要；
  - latest callback events 摘要；
  - callback ticket 列表与 payload preview。
- published invocation detail 现在更接近 page shell + stable sections，而不是继续把 callback 语义混在主面板 JSX 中。

### 2. 补 presenter 级 drilldown 摘要

- 扩展 `web/lib/callback-waiting-presenters.ts`，新增：
  - `formatLatestCallbackTicketLabel`
  - `formatLatestLateCallbackLabel`
  - `formatCallbackTicketStatusSummary`
- 这些 helper 让 publish detail 可以直接展示：
  - 最近一次 ticket 状态 / 原因 / 更新时间；
  - 最近一次 late callback 状态 / 原因 / 时间；
  - 当前 callback ticket 的状态混合概览。

### 3. 面板壳层减负

- `web/components/workflow-publish-invocation-detail-panel.tsx` 不再直接维护 callback summary 与 callback ticket cards 的渲染细节。
- detail panel 现主要保留：
  - invocation header；
  - run drilldown；
  - cache drilldown；
  - request / response preview；
  - approval timeline；
  - callback section 组合入口。

## 影响范围

- Published waiting surface 的 operator 可读性提升，callback / approval 联合排障更集中。
- publish detail 继续沿 section + presenter 方向拆层，减少后续继续补字段时回流到单个大组件的风险。
- 这项改动属于“AI 与人协作层”和“AI 治理层”之间的连接补强：把运行等待、外部 callback、审批阻塞和恢复线索放到同一条可阅读路径上。

## 验证

- `cd web && pnpm exec tsc --noEmit`
  - 结果：通过
- `cd web && pnpm lint`
  - 结果：通过（仅保留 Next.js 对 `next lint` 的上游弃用提示，无实际 lint 错误）

## 下一步

1. 继续把 `workflow-publish-invocation-detail-panel` 剩余 publish drilldown 聚合逻辑抽成 section / presenter，避免后续 cache / request / response / timeline 细节重新堆回壳层。
2. 继续补 callback ticket 与 approval timeline 的 cross-link，例如直接给出更细的 inbox slice / run diagnostics drilldown 跳转。
3. 继续观察 `web/lib/get-workflow-publish.ts` 是否需要按 invocation list / detail / cache / guarded response 再拆一层 fetcher 或 DTO helper。
