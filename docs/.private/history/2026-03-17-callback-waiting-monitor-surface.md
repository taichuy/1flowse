# 2026-03-17 Callback Waiting Monitor Surface

## 背景

- `docs/dev/runtime-foundation.md` 的 `P0 WAITING_CALLBACK` 已把 callback waiting 收敛到 operator triage 主链，但上一轮仍保留一个明显缺口：`monitor_callback / watch_scheduled_resume` 两类建议还主要停留在说明文字。
- 当前 run diagnostics、execution node card 和 published invocation callback drilldown 已经具备手动恢复、expired ticket cleanup、approval inbox slice 与 notification retry 的动作面；如果“继续观察”类路径没有同等明确的 surface，operator 仍容易把观察型建议误读成“系统什么都没接上”。
- 本轮目标不是继续拆组件或美化文案，而是把观察型路径也挂回同一条 callback waiting -> inbox slice -> triage 的主链，避免业务闭环推进又退回细枝末节整理。

## 目标

1. 让 `monitor_callback / watch_scheduled_resume` 两类建议具备和其他推荐动作一致的显式 CTA。
2. 在 callback action 区明确标出“现在建议观察/等待，手动恢复只是次选”的状态提示。
3. 保持实现聚焦在现有 presenter / summary card / inline actions，不新增第二套 waiting 模型或新页面。

## 实现

### 1. presenter 为观察型建议补 CTA 标签

- `web/lib/callback-waiting-presenters.ts`
  - 为 `monitor_callback` 和 `watch_scheduled_resume` 增加 `ctaLabel`。
  - 保持推荐动作结构不变，仍沿既有 `CallbackWaitingRecommendedAction` 输出。

### 2. summary card 为观察型建议复用统一 inbox 入口

- `web/components/callback-waiting-summary-card.tsx`
  - 把 `monitor_callback / watch_scheduled_resume` 纳入与 `open_inbox / inspect_termination` 同一套 CTA 渲染分支。
  - 当存在 `inboxHref` 时，operator 可以直接从 summary card 打开 waiting / approval 对应切片，而不是只读说明文字。

### 3. inline action 区显式提示“观察优先”

- `web/components/callback-waiting-inline-actions.tsx`
  - 新增 `statusHint`，用于承接 summary card 传下来的观察型提示。
  - 在 `compact` action panel 顶部直接说明“先观察 callback ticket 与外部系统”或“系统已安排定时恢复”，让手动恢复/cleanup 的角色变成明确的备选动作，而不是默认主动作。

## 影响评估

### 对架构链条的意义

- 这轮改动没有新增 route、状态机或第二套 waiting/approval 事实层。
- 它强化的是已有 `callback waiting summary -> inbox slice -> manual resume / cleanup / notification triage` 主链，因此增强的是：
  - operator 排障一致性
  - 观察型路径的可理解性
  - triage 行为与 UI 动作面的对应关系

### 对产品场景的意义

- 主要服务对象是**人类 operator**，同时支撑“人与 AI 协作层”的共享排障入口。
- 改动前：
  - 手动恢复与 cleanup 已有按钮；
  - 但“继续观察 callback / 等待 scheduler”更像被动说明，操作优先级不够清楚。
- 改动后：
  - 观察型建议也有明确 CTA；
  - action panel 会提示当前更适合观察还是主动恢复；
  - callback waiting 的 operator triage 闭环更加完整。

## 文件解耦判断

- 本轮没有新增大规模拆文件，因为当前问题的主矛盾不是文件长度，而是观察型路径缺少动作面。
- 解耦仍按以下规则判断：
  1. 是否职责开始混杂、需要稳定插槽承接后续演进；
  2. 是否接近用户偏好阈值：后端约 `1500` 行、前端约 `2500` 行；
  3. 是否能显著改善后续扩展、维护和 AI/人工协作理解成本；
  4. 是否只是为了“拆而拆”。若不能提升主业务闭环，则不优先做。

## 验证

- 计划执行 `web/pnpm exec tsc --noEmit`
- 计划执行 `web/pnpm lint`

## 下一步

1. 继续把 callback waiting 与 notification retry / retarget 的结果联动到同一条 triage 解释链，减少 operator 来回切页判断。
2. 继续评估是否要把“外部 callback 未到达”和“scheduler 已排队恢复”拆成更细的 operator 状态标签。
3. 在不偏离主业务闭环的前提下，再回头处理 editor / publish 剩余热点，而不是重新陷入纯结构整理循环。
