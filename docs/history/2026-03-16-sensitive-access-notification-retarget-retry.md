# 2026-03-16 Sensitive Access Notification Retarget Retry

## 背景

- `runtime-foundation` 的 `P0` 仍明确把 `SensitiveAccessRequest / ApprovalTicket / NotificationDispatch` 的 operator 闭环放在最高优先级。
- 当前 inbox 已支持审批、通知重试、callback 恢复与细粒度 slice，但通知重试仍默认复用旧 target。
- 一旦通知失败原因是 webhook URL、邮箱收件组或机器人地址填错，operator 只能回到别处修配置，再重新制造一轮票据或继续手动排障，动作链偏长。

## 目标

- 让 operator 在 `sensitive-access` inbox 内可以直接修正最新通知目标，并在同一动作里发起 retry。
- 保持现有 durable governance 主链不变：仍沿 `NotificationDispatch` 新建下一次 attempt、保留 superseded 历史、保留 scheduler/worker 轨迹。
- 避免为此新增第二套通知模型或绕开现有 approval / waiting / notification dispatch 事实层。

## 实现

- 后端新增 `NotificationDispatchRetryRequest`，允许 `/api/sensitive-access/notification-dispatches/{dispatch_id}/retry` 接收可选 `target`。
- `SensitiveAccessControlService.retry_notification_dispatch()` 新增 `target_override`，但仍复用 `_create_notification_dispatch()`，因此 target 改派后仍会经过既有 channel preflight / normalization。
- 原始 dispatch 仍会在 superseded 时标记为 `failed`，新的 dispatch 继续作为 latest attempt 落库，并沿既有 `NotificationDispatchScheduler` 进入 worker。
- 前端 `web/app/actions/sensitive-access.ts` 把 retry server action 改为提交 JSON body，并把成功提示更新为显式返回“重试到了哪个目标”。
- `web/components/sensitive-access-inbox-entry-card.tsx` 在最新通知 retry 表单中补上 `Notification target` 输入框，允许 operator 就地改派后重试。
- `web/components/sensitive-access-inline-actions.tsx` 保持兼容现有 inline retry 流程，不强制所有入口都暴露 target 编辑，但状态结构与新 action contract 保持一致。

## 影响评估

### 对架构链条的意义

- 这是在既有 `SensitiveAccessRequest -> ApprovalTicket -> NotificationDispatch -> scheduler/worker` 主链上加厚 operator 动作面，不是新增旁路。
- 它增强的是治理闭环与恢复效率，而不是重新设计通知系统；因此对扩展性、兼容性和稳定性是正增益，不会引入第二套流程控制语义。

### 对产品场景的意义

- 主要服务对象是**人类 operator / 审批处理者**，属于“人与 AI 协作层 + AI 治理层”的交叉能力。
- 改动前：票据通知失败且 target 错误时，operator 只能继续手动跳转排查，重试仍沿用错误目标。
- 改动后：operator 可在 inbox 当前卡片内直接修正 target，并立刻触发新的 dispatch attempt。
- 直接提升：审批通知恢复效率、callback waiting 联合排障效率、人工治理链路完整度。

## 验证

- `api/.venv/Scripts/python.exe -m pytest -q tests/test_sensitive_access_routes.py -k "retry_notification_dispatch"`
  - `3 passed, 8 deselected`
- `api/.venv/Scripts/python.exe -m pytest -q`
  - `317 passed`
- `web/pnpm exec tsc --noEmit`
  - 通过
- `web/pnpm lint`
  - 通过

## 下一步

1. 继续把 inbox / run diagnostics / publish detail 上的恢复建议做成更明确的 action suggestion，而不是只给按钮。
2. 继续补 notification target preset / operator note / audit label，避免频繁手输目标且缺少治理语义。
3. 当通知恢复动作足够稳定后，再评估是否需要把 retarget 能力扩到批量治理，但暂不提前把 UI 做重。
