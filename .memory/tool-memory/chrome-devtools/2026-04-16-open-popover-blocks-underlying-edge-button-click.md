---
memory_type: tool
topic: chrome-devtools 在节点选择弹层打开时无法点击底下的连线加号
summary: 编排画布上如果已有节点选择弹层打开，`chrome-devtools.click` 点击底下的“在此连线上新增节点”会超时；已验证解法是先发送 `Escape` 关闭当前弹层，再点击目标按钮。
keywords:
  - chrome-devtools
  - click
  - timeout
  - popover
  - agent-flow
match_when:
  - 画布上已经有节点选择弹层打开
  - 点击底下的连线加号按钮超时
  - 输出出现 did not become interactive within the configured timeout
created_at: 2026-04-16 11
updated_at: 2026-04-16 11
last_verified_at: 2026-04-16 11
decision_policy: reference_on_failure
scope:
  - chrome-devtools
  - web/app/src/features/agent-flow
---

# 时间

`2026-04-16 11`

## 失败现象

在 agent-flow 画布上，已有节点选择弹层打开时执行：

```text
mcp__chrome-devtools__click {"uid":"...在此连线上新增节点..."}
```

会返回元素在超时时间内没有变为可交互状态。

## 触发条件

- 已先通过拖线在空白区域打开了节点选择弹层
- 继续点击被该弹层覆盖的连线中部 `+` 按钮

## 根因

当前弹层遮住了底下的边中按钮，`chrome-devtools.click` 只能等待目标变为可交互，最终超时。

## 解法

先发送：

```text
mcp__chrome-devtools__press_key {"key":"Escape"}
```

关闭当前节点选择弹层，再重新点击目标连线 `+` 按钮。

## 验证方式

1. 先通过拖线到空白区域打开浮动节点选择器。
2. 直接点击底下连线 `+`，复现超时。
3. 发送 `Escape` 关闭弹层。
4. 再点击同一连线 `+`，成功打开插入节点菜单。

## 复现记录

- `2026-04-16 11`：在 `http://127.0.0.1:3100/applications/app-1/orchestration` 手工验收时复现并验证。
