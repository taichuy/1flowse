# 2026-03-16 callback waiting 联合解释收口

## 背景

- `docs/dev/runtime-foundation.md` 已把“callback waiting 与 approval decision 的联合解释”列为 run diagnostics / publish detail 的 P1 连续工作。
- 现有后端事实层已经提供 `callback_waiting_lifecycle`、callback ticket、approval timeline 与 sensitive access explanation，但前端 execution node card 和 publish invocation detail 仍分别内联展示多个碎片字段。
- 这种呈现方式虽然不缺事实，却仍需要操作者自己在 callback ticket、waiting lifecycle、approval timeline 之间来回拼接，影响用户层和 AI/人协作层的排障效率。

## 目标

- 在不新增第二套事实模型的前提下，把 callback waiting、scheduled resume 与 approval pending 的联合解释收口到统一前端 presenter / component。
- 顺带压缩 `web/components/workflow-publish-invocation-detail-panel.tsx` 的继续膨胀趋势，保持 publish detail 壳层可继续演进。

## 实现

- 新增 `web/lib/callback-waiting-presenters.ts`，统一承接 callback waiting headline、approval summary、scheduled resume 标签、lifecycle summary 与 chip 列表的生成逻辑。
- 新增 `web/components/callback-waiting-summary-card.tsx`，把 callback ticket、approval pending、scheduled resume、termination 与 waiting reason 聚合成同一块 operator-facing explanation。
- `web/components/run-diagnostics-execution/execution-node-card.tsx` 改为复用 `CallbackWaitingSummaryCard`，不再在节点卡片里重复内联 callback waiting 的 chip / termination 分支。
- `web/components/workflow-publish-invocation-detail-panel.tsx` 复用同一解释卡片，把 publish invocation detail 中原先分散的 callback lifecycle / scheduled resume 文案收口到共享组件，同时保留结构化基础字段，方便后续继续拆 publish detail 热点。

## 影响范围

- run diagnostics execution node card
- publish invocation detail panel
- callback waiting / approval 联合排障体验
- 前端长文件治理热点，尤其是 publish detail presenter 层

## 验证

- `web/pnpm exec tsc --noEmit`
- `web/pnpm lint`

## 结果判断

- 这轮没有新增后端字段，也没有引入新的运行时分支；只是把既有 callback waiting 与 approval 事实更稳定地映射到用户可读解释层。
- 对“项目完整度”的帮助主要体现在两点：
  - 用户层：run detail / publish detail 更容易直接看出“是 callback 卡住、approval 卡住，还是两者一起卡住”。
  - AI 与人协作层：前端终于把共享事实源收成一套联合解释，不需要再依赖人工跨多个区块拼装判断。

## 下一步

- 继续把 execution node card 内的 tool / ai / ticket / artifact 区块拆成更细的 section component。
- 继续治理 `web/lib/get-workflow-publish.ts` 的聚合读取与 presenter 热点，避免 publish detail 后续再把复杂度拉回单文件。
