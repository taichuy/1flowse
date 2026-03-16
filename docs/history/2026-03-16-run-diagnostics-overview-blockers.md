# 2026-03-16 run diagnostics overview blocker 卡片

## 背景

- `docs/dev/runtime-foundation.md` 持续把 `WAITING_CALLBACK` 与 sensitive access 的联合 operator 闭环列为 `P0`。
- 前几轮已经把 callback waiting summary、published callback drilldown、细粒度 inbox slice、inline approve/retry 和 manual resume 接到 node card、publish detail 与 blocked card。
- 但 run diagnostics 的 execution overview 首屏仍主要停留在统计摘要，operator 往往还要先钻进 node card，才能看到“哪个 node 最该先处理、并且可以立即做什么动作”。

## 目标

- 把最值得优先处理的 waiting / approval 节点直接前置到 execution overview。
- 复用现有 `CallbackWaitingSummaryCard` 与 inline actions，不再发明第二套恢复入口。
- 顺手继续保持 `run-diagnostics-execution/*` 的拆层方式，避免把 blocker 聚合逻辑重新堆回 overview 单文件。

## 实现

### 1. 新增 overview blocker 组件

- 新增 `web/components/run-diagnostics-execution/execution-overview-blockers.tsx`。
- 该组件会基于 pending approval、pending callback ticket、expired / late callback、waiting status 等信号，为 execution nodes 计算优先级，并展示前 3 个最值得 operator 先处理的 blocker。

### 2. 复用现有 callback / approval 主链

- 每张 blocker 卡片继续复用 `CallbackWaitingSummaryCard`，因此 overview 首屏也天然继承：
  - `立即尝试恢复`
  - `处理过期 ticket 并尝试恢复`
  - `open inbox slice`
- 这样 run diagnostics 首屏终于不只“告诉你有几个 blocker”，而是能把最关键的阻断节点和恢复动作直接前置。

### 3. 保持 decoupling

- `web/components/run-diagnostics-execution/execution-overview.tsx` 只负责接入新组件，不把排序与 blocker 选择逻辑继续内联回 overview 主文件。
- 这符合当前前端热点治理方向：新增聚合能力优先拆成独立 section / presenter，而不是反向把 overview 再堆成难维护的单体文件。

## 影响

- **人类 operator**：在 run diagnostics 首屏就能看到最优先的 waiting / approval blocker，不必先逐个翻 node card。
- **人与 AI 协作层**：callback waiting 与 approval pending 的联合阻断不再只存在于深层 drilldown，也进入 shared overview 事实面。
- **可靠性 / 稳定性**：这轮不是修样式细节，而是在缩短“发现阻断 -> 判断顺序 -> 执行动作”的恢复链路。

## 验证

- `cd web; pnpm exec tsc --noEmit`
- `cd web; pnpm lint`
- `git diff --check`

## 下一步

1. 继续把 overview blocker 从“有动作入口”推进到“有更明确的 action suggestion”，例如优先提示先 approve、先 cleanup 还是先 resume。
2. 继续把 publish detail 剩余聚合逻辑抽到 presenter / section helper，避免 diagnostics / publish 两条线的复杂度回流。
