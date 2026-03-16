# 2026-03-16 sensitive access 邮件通知 adapter 补完

## 背景

本轮先按仓库协作约定复核了以下事实来源：

- `AGENTS.md`
- `docs/dev/user-preferences.md`
- `docs/product-design.md`
- `docs/open-source-commercial-strategy.md`
- `docs/technical-design-supplement.md`
- `docs/dev/runtime-foundation.md`
- 最近一次 Git 提交 `dfcff2a refactor: split agent runtime llm phase helpers`
- 最近一批 `docs/history/2026-03-16-*.md` 留痕与当前 `api/` 结构热点

复核结论是：项目基础框架已经足够继续推进主业务闭环，不需要回退重搭底座；当前最值得继续衔接的 P0 主线之一，仍是统一敏感访问控制闭环。

在上一轮通知 worker 落地后，`NotificationDispatch` 已具备真实的 `pending -> worker -> delivered/failed` 主链，但 `email` 通道仍停留在“adapter 明确失败”的占位状态。这会让敏感访问控制在对外说明上已经进入真实通知阶段、在实际渠道能力上却仍缺一块，影响治理闭环的完整度。

## 目标

本轮优先把 `email` 通道从占位失败补成最小真实可用的 SMTP adapter，同时保持以下边界不变：

- 不引入第二套审批 / 通知事实模型
- 不改变 `NotificationDispatchScheduler` 与 worker 主链
- 不把邮件投递逻辑散落回 request path
- 继续让 `NotificationDispatchRecord` 作为唯一投递事实来源

## 本轮实现

### 1. 为通知服务补可配置 SMTP 邮件 adapter

- 更新 `api/app/services/notification_delivery.py`
- `EmailNotificationAdapter` 不再固定返回失败，而是支持：
  - 解析 `notification_target` 中的邮箱地址列表（支持 `,` / `;` 与 `mailto:`）
  - 构造邮件主题与正文
  - 通过 SMTP / SMTP+STARTTLS / SMTP SSL 发信
  - 在配置缺失、地址非法或 SMTP 异常时，统一回落到 `failed` 并写入可读错误

### 2. 把邮件配置收敛到统一设置入口

- 更新 `api/app/core/config.py`
- 新增：
  - `notification_email_smtp_host`
  - `notification_email_smtp_port`
  - `notification_email_smtp_username`
  - `notification_email_smtp_password`
  - `notification_email_from_address`
  - `notification_email_from_name`
  - `notification_email_use_ssl`
  - `notification_email_starttls`
- 更新 `api/.env.example`，让本地和部署配置入口与代码事实保持一致

### 3. 为邮件投递补服务层回归测试

- 更新 `api/tests/test_notification_delivery.py`
- 新增覆盖：
  - SMTP 配置存在时，`email` 通道可成功投递并更新 `NotificationDispatchRecord`
  - SMTP 配置缺失时，`email` 通道会明确失败而不是静默吞掉

## 影响范围

- 统一敏感访问控制的通知链不再只剩 `webhook / slack / feishu` 有真实外发能力，`email` 现在也进入同一条 durable delivery 主链
- 运维或审批人可以继续复用现有 inbox / retry 入口，无需理解新的邮件分支语义
- `NotificationDeliveryService` 仍保持“渠道 adapter + 单一事实写回”的结构，没有破坏已有 worker/transaction-aware 调度边界

## 验证

在 `api/` 目录执行：

```powershell
.\.venv\Scripts\uv.exe run pytest tests/test_notification_delivery.py -q
.\.venv\Scripts\uv.exe run ruff check app/core/config.py app/services/notification_delivery.py tests/test_notification_delivery.py
.\.venv\Scripts\uv.exe run pytest -q
```

结果：

- `tests/test_notification_delivery.py -q`：`4 passed`
- changed-files `ruff check`：通过
- 后端全量测试：`284 passed`

## 结论

- 最近提交链依然需要衔接，但不需要回头重写架构；当前主干已经足够支撑持续功能开发
- 本轮把统一敏感访问控制里仍然“口径已到、能力未到”的 `email` 通道补齐到最小真实可用状态
- 当前项目仍未进入“只剩人工逐项界面设计 / 人工验收”的阶段，因此本轮不触发通知脚本 `node "e:\code\taichuCode\ai-presson-wen\aionui\notice\kill-port-8050.js"`

## 下一步建议

1. **P0：继续补敏感访问 operator 治理面**
   - 优先做批量 approve / reject / retry，以及更清晰的 delivery status explanation
2. **P0：继续补通知目标与渠道治理**
   - 优先做 target 校验、渠道预设、健康检查与配置可观测性
3. **P1：继续治理 run / publish / inbox 的安全解释层**
   - 把相同审批 / 通知事实在三个入口收敛成更一致的 operator 说明
