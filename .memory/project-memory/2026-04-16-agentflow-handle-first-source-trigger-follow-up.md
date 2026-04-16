---
memory_type: project
topic: agentFlow editor 节点出口改为 handle-first 入口
summary: 在 store-centered 重构完成后，用户继续要求把节点出口 `+` 从覆盖按钮收口为 Dify 式 `handle-first` 入口；当前 source handle 已同时支持点击打开节点菜单与拖线，并保持空白落点 picker、edge 插入与移动端桌面提示不变。
keywords:
  - agent-flow
  - handle
  - node picker
  - react-flow
  - follow-up
match_when:
  - 继续维护 agent-flow 节点出口交互
  - 需要区分 source handle、edge 插入和空白落点 picker 的实现语义
  - 需要确认 store-centered 重构后的后续交互修正
created_at: 2026-04-16 12
updated_at: 2026-04-16 12
last_verified_at: 2026-04-16 12
decision_policy: verify_before_decision
scope:
  - web/app/src/features/agent-flow/components/nodes/AgentFlowNodeCard.tsx
  - web/app/src/features/agent-flow/components/node-picker/NodePickerPopover.tsx
  - web/app/src/features/agent-flow/components/canvas/CanvasHandle.tsx
  - web/app/src/features/agent-flow/_tests/agent-flow-node-card.test.tsx
---

# agentFlow editor 节点出口改为 handle-first 入口

## 时间

`2026-04-16 12`

## 谁在做什么

- 用户在 store-centered 重构计划完成后，继续审查连线体验，明确要求把节点出口 `+` 收成与 Dify 更接近的 `handle-first` 交互。
- AI 在现有 store-centered 架构上，调整 source handle / node picker 结构，并补充针对性回归测试。

## 为什么这样做

- 上一轮修复虽然恢复了“能拖线”和“空白处弹 picker”，但节点出口仍然是 `Handle > Button > Popover` 的覆盖结构。
- 用户明确指出这不是统一的连接入口语义，希望出口本体就是连接器，而不是再盖一个按钮层。

## 为什么要做

- 需要让 source handle 同时承担 click 和 drag，同一入口既能点开下一个节点菜单，也能直接拖线。
- 还要保持 `edge` 中点插入和空白落点 picker 的现有语义，不把三种入口错误地统一成同一种底层实现。

## 截止日期

- 无单独新截止日期；作为 `2026-04-16` 当天 `agent-flow` 连线问题的跟进修复完成。

## 决策背后动机

- 视觉可以统一，但 source handle、edge 插入、空白落点三者语义不同。
- 因此当前决策是：source handle 改成 `handle-first`；`NodePickerPopover` 退回成复用菜单层；edge 中点与空白落点继续走按钮/锚点语义。
