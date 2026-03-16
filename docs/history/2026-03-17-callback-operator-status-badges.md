# 2026-03-17 Callback Operator Status Badges

## 背景

- `docs/dev/runtime-foundation.md` 已把 `P0 WAITING_CALLBACK` 明确为当前最优先的 operator triage 主线之一。
- 2026-03-17 上一轮提交 `74c3038 feat: align callback inline action guidance` 已把 callback summary 的推荐动作和当前页 inline action surface 对齐。
- 但 callback summary 里仍主要通过 recommendation 与 lifecycle 文案表达状态，operator 还不够容易一眼区分“仍在等外部 callback”“系统已排队定时恢复”“已有 late callback 可手动恢复”等不同场景。

## 目标

1. 把 callback waiting 的核心 operator 状态显式化，而不是继续只靠 recommendation 推断。
2. 让人类 operator 在 run diagnostics / publish callback drilldown 里更快判断当前该观察、该等待、还是该立即恢复。
3. 继续推进 waiting / governance 主线，而不是回到纯样式微调或脱离业务的文件整理。

## 实现

### 1. presenter 补齐 operator status 模型

- `web/lib/callback-waiting-presenters.ts`
  - 新增 `CallbackWaitingOperatorStatus` 类型。
  - 新增 `listCallbackWaitingOperatorStatuses()`，统一产出：
    - `approval pending`
    - `waiting external callback`
    - `scheduled resume queued`
    - `late callback recorded`
    - `callback waiting terminated`
  - 新增 `formatCallbackWaitingOperatorStatusSummary()`，把状态 badge 对应的解释拼成可读摘要。

### 2. summary card 显式展示状态 badge 与解释

- `web/components/callback-waiting-summary-card.tsx`
  - 在原有 chips 之外新增 operator status chips。
  - 新增 `Status:` 摘要文案，直接解释当前等待是卡在外部 callback、scheduler backoff，还是已经具备 manual resume 条件。
  - 同时把该摘要纳入卡片显隐条件，避免只剩 operator state 时卡片被误判为空。

## 影响评估

### 对架构链条的意义

- 本轮没有新增新的 runtime 状态机、数据模型、route 或第二套 waiting 语义。
- 增强的是既有 `callback lifecycle -> presenter -> summary card -> inline actions` 的解释层。
- 这说明当前架构已经足够支撑继续加厚 operator triage 闭环：不需要回头重搭模型，只要沿统一 presenter / action surface 持续补齐状态解释即可。

### 对产品场景的意义

- 主要服务对象是**人类 operator**，但它直接增强了“人与 AI 协作层”的排障与恢复速度。
- 改动前：
  - operator 可以看到 recommendation；
  - 但还要自己推断当前到底是在等外部 callback，还是等 scheduler backoff。
- 改动后：
  - 状态 badge 直接把等待态拆开；
  - `Status:` 文案说明当前阻塞类型与下一步关系；
  - callback summary 更接近真正的 triage 卡片，而不是只做信息拼接。

## 文件解耦判断

- 本轮仍未继续拆文件。
- 判断依据：当前问题不是文件长度，而是 callback waiting 解释语义还不够完整。
- 保持以下解耦规则：
  1. 先确认是否出现稳定职责边界；
  2. 再看是否逼近偏好阈值：后端约 `1500` 行、前端约 `2500` 行；
  3. 同时确认拆分是否真的降低人类与 AI 的理解/维护成本；
  4. 不为了形式整洁而打断主业务闭环推进。

## 验证

- `web/pnpm exec tsc --noEmit`
- `web/pnpm lint`
- `git diff --check`

## 下一步

1. 继续把 approval / notification 执行后的“结果是否足以恢复 run”补成更明确的 operator explanation。
2. 继续评估 callback summary 是否需要把 external callback 与 scheduled resume 的状态优先级排序得更明显，例如把真正 blocker 放在最前。
3. 保持优先级在 waiting / governance / editor 主线，不把精力重新拉回纯结构整理。
