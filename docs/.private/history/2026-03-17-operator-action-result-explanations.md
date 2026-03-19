# 2026-03-17 Operator Action Result Explanations

## 背景

- `docs/dev/runtime-foundation.md` 已把 `P0 WAITING_CALLBACK` 的下一步明确收敛到“补动作执行后 run 是否真正恢复的结果解释”。
- 2026-03-17 上一轮提交 `a3c944b feat: add callback operator status badges` 已把 callback waiting 的状态 badge 与 `Status:` 摘要补齐。
- 但当前 operator 在 run diagnostics / published callback drilldown 中执行“手动恢复”“cleanup 过期 ticket”“审批通过/拒绝”“通知重试”后，虽然能看到即时反馈，却还缺少更稳定的一层结果解释：这次动作到底改变了什么，下一步应该看哪里，run 是否一定已经恢复。

## 目标

1. 继续沿 `WAITING_CALLBACK` 主线补强 operator triage，而不是转去做与主业务闭环无关的样式微调。
2. 把手动恢复、cleanup、审批与通知重试的“动作预期 + 结果解释”统一收口，减少不同 action 各自散写文案导致的认知漂移。
3. 让人类 operator 在同一页就能更清楚地区分“动作已提交”和“阻塞已经解除”这两件事。

## 实现

### 1. 新增统一结果解释 presenter

- 新增 `web/lib/operator-action-result-presenters.ts`
  - 统一承载 callback/manual resume、expired ticket cleanup、approval decision、notification retry 四类 operator 动作的：
    - 动作前预期说明
    - 动作后结果说明
  - 避免 server action 与组件层各自散落一套相近但不完全一致的解释文案。

### 2. server action 改为复用共享结果解释

- `web/app/actions/runs.ts`
  - 手动恢复成功后，不再只返回“当前 run 状态：xxx”，而是显式区分：
    - 仍在 `waiting`
    - 已回到 `running`
    - 已 `succeeded`
    - 已 `failed`
    - 其他未知状态
- `web/app/actions/callback-tickets.ts`
  - cleanup 成功后，不再只给计数汇总，而会说明：
    - 没有发现过期 ticket 时，operator 应继续检查审批 / callback / scheduled resume
    - 有恢复调度时，应回看 run 是否真正推进
    - 有终止链路时，应按失败路径继续排障
- `web/app/actions/sensitive-access.ts`
  - 审批通过/拒绝后，显式告诉 operator：是交回 runtime 继续恢复，还是维持 blocked / failed 语义。
  - 通知重试后，显式区分 `delivered / pending / failed` 三种结果，并强调“通知送达”不等于“run 已恢复”。

### 3. inline action 卡片补动作预期说明

- `web/components/callback-waiting-inline-actions.tsx`
  - 手动恢复按钮下方改为共享解释文案，强调“恢复尝试”与“真正离开 waiting”并不是同一个结论。
  - cleanup 按钮下方改为共享解释文案，强调它只处理当前 slice 内已过期 ticket，不代表业务链路自动完成。
- `web/components/sensitive-access-inline-actions.tsx`
  - 审批动作下方补“批准/拒绝分别会把链路带向哪里”的稳定说明。
  - 通知重试下方补“只负责重新送达审批请求，不直接恢复 run”的稳定说明。

## 影响评估

### 对架构链条的意义

- 这次没有新增第二套 waiting 模型、审批模型或通知模型。
- 增强的是现有 `run / callback / approval / notification` 主链之上的 **operator explanation layer**。
- 这说明当前架构已经能承接后续功能开发：当前真正缺的不是推翻重做，而是继续沿既有 runtime facts + action surface 把“人如何理解并接手恢复”补完整。

### 对产品闭环的意义

- 主要服务对象是 **人类 operator**，归属于“AI 与人协作层”的排障/恢复场景。
- 改动前：
  - operator 能执行动作；
  - 但动作成功提示仍容易被误读为“问题已经解决”。
- 改动后：
  - operator 能更明确区分“动作已提交”“通知已送达”“审批已通过”“run 真正恢复推进”这些不同层次；
  - callback waiting 的主链因此更接近真正的 triage 闭环，而不是只有入口和按钮。

## 文件解耦判断

- 本轮做了小规模解耦，但不是为了形式上的拆文件。
- 判断依据：
  1. 这批文案已在多个 action / component 中重复出现，属于稳定职责；
  2. 统一抽到 presenter 可以减少后续继续补 operator explanation 时的漂移；
  3. 当前文件长度并未触发必须拆分阈值，重点是“职责聚合是否合理”，不是机械按行数拆；
  4. 这种解耦同时对人和 AI 都更友好：人更容易定位文案语义源头，AI 也更容易沿统一入口持续补闭环。

## 验证

- `web/pnpm exec tsc --noEmit`
- `web/pnpm lint`
- `git diff --check`

## 下一步

1. 继续把“动作执行后最新 blocker 是否减少、run 是否离开 waiting”做成更持久的页面事实，而不只靠即时成功消息提示。
2. 继续推进 `P0 WAITING_CALLBACK`，优先补 callback summary / publish detail 中动作后的 fresh snapshot 或 blocker delta。
3. 保持优先级集中在 waiting / diagnostics / editor 主线，不回头陷入纯文件整理或非闭环型微调。
