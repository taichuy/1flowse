---
memory_type: project
topic: agentFlow 连线 follow-up 已补齐分支新增与 edge 删除交互
summary: 用户在 `2026-04-16 17` 继续指出 agentFlow editor 的拖线松手节点选择、分支新增和 edge 删除缺口；当前已改为 source 直接分支新增节点、edge 支持选中与 `Delete/Backspace` 删除，并通过前端全量验证。
keywords:
  - agent-flow
  - edge
  - branching
  - node-picker
  - delete
  - follow-up
match_when:
  - 需要继续维护 agent-flow 的连线、新增节点或 edge 删除交互
  - 需要判断拖线新增节点是否应保留原有出边形成分支
  - 需要确认 edge 是否已有选中态与键盘删除能力
created_at: 2026-04-16 17
updated_at: 2026-04-16 17
last_verified_at: 2026-04-16 17
decision_policy: verify_before_decision
scope:
  - web/app/src/features/agent-flow
  - docs/superpowers/plans/2026-04-16-agentflow-editor-store-centered-restructure.md
---

# agentFlow 连线 follow-up 已补齐分支新增与 edge 删除交互

## 时间

`2026-04-16 17`

## 谁在做什么

用户在 store-centered 重构完成后，继续验收 `agent-flow` editor 的 Dify 式连线交互；本轮针对拖线新增节点、edge 选中和键盘删除做 follow-up 修补，并同步更新测试与计划记录。

## 为什么这样做

上一轮虽然已经把节点出口收口成 `handle-first`，但拖线落到空白区域后新增节点仍复用了“插到现有节点后面”的串行逻辑，导致原有出边被改写；同时 editor 还缺少 edge 选中删除闭环，不满足基本图编辑心智。

## 为什么要做

用户明确要求对齐 Dify 式工作流体验：拖线松手直接出现节点选择、从 source 新增节点默认形成分支而不是重写原链路、现有边必须可选中删除。若不补齐，这轮 store-centered 重构在真实编排场景下仍不可用。

## 截止日期

`2026-04-16 17`

## 决策背后动机

实现上维持“视觉统一、语义分层”的原则：source handle 仍是真实连线起点；空白落点 picker 负责从 source 分支新增；edge 中点继续承担“在线上插节点”；edge 选中和删除单独走 selection / shortcut 链路，避免把不同语义硬糅成同一套实现。
