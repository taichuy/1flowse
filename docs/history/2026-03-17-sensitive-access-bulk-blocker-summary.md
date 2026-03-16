# 2026-03-17 Sensitive Access Bulk Blocker Summary

## 背景

- `docs/dev/runtime-foundation.md` 已把 `P0 WAITING_CALLBACK` 主线收敛到“统一治理入口里解释动作后事实”，避免 operator 在审批、通知重试与 callback 恢复之间来回跳转。
- 2026-03-17 上一轮已让 bulk approval / bulk notification retry 接入样本 run follow-up，但结果仍主要停留在一次性 message 中；bulk governance card 自身还看不出“这次动作之后，受影响 run 目前是否还卡着”。
- 这会让 operator 在 message 消失或切换筛选后，仍需要再次打开多个 run detail 才能复盘本次批量动作是否真正减少 blocker。

## 目标

- 把 bulk 动作后的 run 状态汇总沉淀到 `SensitiveAccessBulkActionResult`，而不只是一段提示文案。
- 让 `/sensitive-access` inbox 的 bulk governance card 直接显示受影响 run 的当前阻塞面，继续沿同一条 operator explanation layer 推进。
- 保持现有 action -> presenter -> card 分层，不新增第二套 bulk runtime / 状态机。

## 实现

### 1. 为 bulk 结果补充结构化 follow-up 指标

- 更新 `web/lib/get-sensitive-access.ts`
  - 为 `SensitiveAccessBulkActionResult` 新增：
    - `affectedRunCount`
    - `sampledRunCount`
    - `waitingRunCount`
    - `runningRunCount`
    - `succeededRunCount`
    - `failedRunCount`
    - `unknownRunCount`
- 这样 bulk 结果不再只有 `updated / skipped` 计数，也能保留动作后 blocker 面的结构化摘要。

### 2. 沿 presenter 层复用 bulk run summary 逻辑

- 更新 `web/lib/operator-action-result-presenters.ts`
  - 新增 `summarizeBulkRunFollowUp()`，从样本 run snapshot 中统一汇总状态分布。
  - 继续由同一个 presenter 层负责 bulk follow-up 的字符串说明与结构化汇总，避免 server action 和 UI 各自重复计算。

### 3. bulk action 回填结构化 blocker 面

- 更新 `web/app/actions/sensitive-access.ts`
  - `bulkDecideSensitiveAccessApprovalTickets()` 与 `bulkRetrySensitiveAccessNotificationDispatches()` 在回读样本 run snapshot 后，会额外产出 follow-up summary 并写回 `SensitiveAccessBulkActionResult`。
  - 错误路径与空输入路径也统一补零值指标，避免 UI 再做额外兜底分支。
  - 进一步把“规范化 run id -> 读取样本 snapshot -> 汇总 follow-up”收口到共享 helper，避免两条 bulk action 路径继续复制同一段收尾逻辑。

### 4. 让 bulk governance card 直接显示动作后现状

- 更新 `web/components/sensitive-access-bulk-governance-card.tsx`
  - 在原有 `updated / skipped` 和 skip reason 之外，新增显示：
    - `affected runs`
    - `sampled`
    - `still waiting`
    - `running`
    - `succeeded`
    - `failed`
    - `unknown`
- 这样 operator 即使不重新阅读长 message，也能直接看到这次批量治理后当前卡住的是“还有多少 waiting”，还是已经进入 `running / succeeded / failed`。

## 影响

### 架构与扩展性

- 增强的是既有 **operator explanation layer**，不是新增执行链或额外 runtime。
- 这说明当前架构仍满足你关注的几项要求：
  - **扩展性**：bulk 结果面继续复用 `RunSnapshot` 与 presenter helper，后续可继续把同类 summary 接到 publish detail / callback summary。
  - **兼容性**：没有引入与特定协议或特定节点绑定的模型，仍围绕统一 run facts 工作。
  - **可靠性 / 稳定性**：错误分支也返回稳定结构，UI 不需要猜测 bulk 动作后是否有 follow-up 数据。
  - **安全性**：只是读取既有 run 事实并做汇总，不扩大敏感访问权限边界。
  - **可维护性 / 解耦**：server action 中重复的 bulk follow-up 收尾已被 helper 吸收，后续新增 bulk 动作时更容易沿同一契约扩展，而不是继续复制 `runIds -> snapshots -> summary` 逻辑。

### 业务闭环价值

- 对象：主要是 **人类 operator**；同时也为未来 AI 读取统一治理事实提供更稳定的结果结构。
- 场景：`/sensitive-access` inbox 中的 bulk approval / bulk notification retry。
- 变化前：bulk 卡片只能显示“做了多少、跳过多少”，动作后 blocker 是否减少需要手动继续跳 run detail。
- 变化后：bulk 卡片自身就能回答“本次影响了多少个 run、其中还有多少仍在 waiting、多少已继续 running / succeeded / failed”。
- 结果：waiting / approval / notification 的联合治理更接近真正闭环，而不是只完成了“提交动作”。

## 验证

- `web/pnpm exec tsc --noEmit`
- `web/pnpm lint`
- `git diff --check`

## 下一步

1. 把同类 blocker summary 再继续接到 callback summary / publish detail，而不是只停留在 inbox bulk card。
2. 继续把页面层残余的手工结果拼接收口到 presenter / helper，避免同一类 operator 解释分叉。
3. 在 `P0 WAITING_CALLBACK` 主线更稳后，再回到 editor / publish 的 P1 热点，继续补产品完整度。
