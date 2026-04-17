---
memory_type: project
topic: agentflow 节点详情默认宽度恢复为可读值，紧凑布局改按 dock 宽度切换
project_memory_state: implemented
summary: 节点详情配置区改为 section 平铺后，`320px` 默认宽度会把桌面端 inspector 挤坏；当前实现已把默认宽度恢复为 `420px`，并新增按 dock 实际宽度切换 `regular/compact` 布局，避免继续用 viewport 媒体查询判断右侧面板表单密度。
keywords:
  - agentflow
  - node detail
  - detail dock
  - compact layout
  - inspector
match_when:
  - 后续继续调整 agentflow 节点详情宽度或表单布局
  - 需要判断 node detail 的响应式是跟随 viewport 还是 dock 宽度
created_at: 2026-04-17 23
updated_at: 2026-04-17 23
last_verified_at: 2026-04-17 23
decision_policy: verify_before_decision
scope:
  - web/app/src/features/agent-flow/lib/detail-panel-width.ts
  - web/app/src/features/agent-flow/components/editor/AgentFlowCanvasFrame.tsx
  - web/app/src/features/agent-flow/components/editor/agent-flow-editor.css
  - web/app/src/style-boundary/scenario-manifest.json
---

# agentflow 节点详情默认宽度恢复为可读值，紧凑布局改按 dock 宽度切换

## 时间

`2026-04-17 23`

## 谁在做什么

- 用户指出 agentflow 的节点详情 UI “跑偏”，截图显示右侧设置区在桌面端被压得过窄。
- AI 追查到 detail dock 默认宽度与 inspector 的响应式条件不匹配，并已完成实现修正。

## 为什么这样做

- 配置区此前已经从 accordion 改为 section 平铺，信息密度显著提高。
- 右侧 dock 仍维持 `320px` 默认宽度，同时 inspector 的 inline 字段只按 viewport 媒体查询切换，导致桌面大屏下右侧窄 panel 仍使用双列紧凑排版，控件被压扁。

## 为什么要做

- 让节点详情在默认打开时就保持可读，不要求用户先手动拖宽。
- 保证后续即使用户把 dock 拖窄，表单也能自动进入 compact 布局，而不是继续挤压字段控件。

## 截止日期

- 无

## 决策背后动机

- detail dock 默认宽度恢复为 `420px`，但仍保留用户可继续拖窄到更小宽度的能力。
- 节点详情布局状态改为由 dock 实际宽度派生 `regular/compact`，不再只看整个 viewport。
- `compact` 模式下，inspector inline 字段和 policy 区控件会切成更适合窄 panel 的堆叠布局。
- style boundary 的 `page.application-detail` 场景已同步默认宽度断言到 `420px`。
