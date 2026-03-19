# 2026-03-17 Callback ticket row presenters

## 背景

- `docs/dev/runtime-foundation.md` 已把 `P1 run diagnostics / publish detail` 的下一步收敛到：继续清理 `execution node card` 与 callback ticket 列表里的残余手工结果拼接，避免 operator 入口之间再次漂移。
- 当前 `ExecutionNodeCallbackTicketList` 与 published invocation detail 中的 callback ticket 卡片仍各自手写 `Waiting status / Reason / Created / Expires / Consumed / Canceled / Expired` 这批字段；一边偏紧凑、一边偏详细，但两边都直接在 JSX 里组装 ticket 事实。

## 目标

1. 把 callback ticket 的稳定字段表达收口到共享 presenter，而不是继续在 execution / publish 两个入口各自拼装。
2. 让 run diagnostics 与 publish detail 至少共享同一份 ticket row 模型，减少后续继续补 operator 入口时的重复劳动。
3. 保持这轮仍围绕 `WAITING_CALLBACK` 排障主链推进，不切换到无关重构主题。

## 实现

### 1. 新增 callback ticket detail presenter

- 更新 `web/lib/callback-waiting-presenters.ts`。
- 新增：
  - `formatCallbackTicketLifecycleSummary()`
  - `listCallbackTicketDetailRows()`
- 这两个 helper 负责把 callback ticket 的稳定事实收口为两种模式：
  - `compact`：给 execution node card 使用，输出 `Waiting status / Reason / Lifecycle`
  - `detail`：给 publish detail 使用，输出 `Ticket / Node run / Tool / Waiting status / Reason / Created / Expires / Consumed / Canceled / Expired`

### 2. execution node card 改吃共享 compact rows

- 更新 `web/components/run-diagnostics-execution/execution-node-card-sections.tsx`。
- `ExecutionNodeCallbackTicketList` 现在不再手写 reason + lifecycle payload，而是：
  - 通过 `listCallbackTicketDetailRows(ticket, { mode: "compact" })` 渲染结构化摘要；
  - 保留原有 inbox slice 入口；
  - 把 `<pre>` 中的原始 JSON 收缩为 `callback_payload + tool_call_id`，避免把本应稳定展示的 ticket lifecycle 又塞回原始 payload。

### 3. publish detail 的 callback ticket 卡片复用同一份 rows

- 更新 `web/components/workflow-publish-invocation-callback-section.tsx`。
- published invocation detail 中每张 callback ticket 卡片现在统一通过：
  - `listCallbackTicketDetailRows(ticket, { mode: "detail", includeEmptyLifecycle: true })`
  - 渲染 detail rows。
- 这样 publish detail 不再在 JSX 中维护一长串 `dt/dd` 字段，后续若 ticket 字段或显示策略变化，只需要改 presenter。

## 影响评估

### 对主链闭环的帮助

- **用户层**：run diagnostics 与 publish detail 对 callback ticket 的解释更一致，operator 不用在两个入口重新学习字段组织方式。
- **人与 AI 协作层**：callback ticket 的稳定事实被收口成可复用 row 模型，更适合继续向其他 operator 入口扩展，而不是复制 JSX 片段。
- **AI 治理层**：callback waiting 的排障信息进一步从“原始 payload + 分散字段”收敛到“结构化行 + 原始 payload 兜底”，让治理解释与原始证据的边界更清楚。

### 架构与可维护性

- 这轮没有新增新的 API、状态或页面，只是把 callback ticket 这个稳定事实层从页面 JSX 下沉到 presenter。
- 后续若还要把 callback ticket 摘要接到 published invocation entry card、更多 run diagnostics section 或 inbox 详情，可继续复用同一份 row helper。

## 验证

- `web/pnpm exec tsc --noEmit`
- `web/pnpm lint`
- `git diff --check`

结果：

- `tsc` 通过
- `lint` 通过
- `git diff --check` 通过（仅有工作区 LF/CRLF 提示，无空白或语法错误）

## 下一步

1. 继续把 published invocation entry card 内残余的 waiting drilldown 手工拼装收口到共享 callback waiting rows。
2. 继续复用同一套 row / presenter helper，把 execution node card 和 publish detail 中剩余的 recommendation / lifecycle 文案继续下沉，避免回到单体 JSX 里堆业务判断。
3. 等 `WAITING_CALLBACK` 的 operator 入口进一步稳定后，再回到 `P0 execution/sandbox` 与 `P1 editor completeness` 的剩余主线。
