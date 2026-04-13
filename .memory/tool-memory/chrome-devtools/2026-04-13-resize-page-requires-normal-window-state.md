---
memory_type: tool
topic: chrome-devtools 的 resize_page 在非 normal 窗口态下会失败
summary: 使用 `mcp__chrome-devtools__resize_page` 做页面验收时，如果浏览器窗口当前不是 normal 状态，会返回 `Browser.setContentsSize` 协议错误；改用 `mcp__chrome-devtools__emulate` 设置 viewport 可以稳定完成桌面端和移动端检查。
keywords:
  - chrome-devtools
  - resize_page
  - emulate
  - viewport
  - Browser.setContentsSize
match_when:
  - 使用 chrome-devtools 调整页面尺寸
  - 输出出现 `Restore window to normal state before setting content size`
created_at: 2026-04-13 19
updated_at: 2026-04-13 19
last_verified_at: 2026-04-13 19
decision_policy: reference_on_failure
scope:
  - chrome-devtools
  - frontend verification
---

# chrome-devtools 的 resize_page 在非 normal 窗口态下会失败

## 时间

`2026-04-13 19`

## 失败现象

执行：

```text
mcp__chrome-devtools__resize_page {"width":1440,"height":960}
```

时返回：

```text
Protocol error (Browser.setContentsSize): Restore window to normal state before setting content size
```

## 触发条件

- 用 chrome-devtools 做页面验收或截图前，直接调用 `resize_page`
- 当前浏览器窗口状态不满足 `Browser.setContentsSize` 的要求

## 根因

`resize_page` 依赖底层窗口处于可恢复的 normal 状态；当当前页签所在窗口不满足这个前提时，协议层会直接拒绝设置内容尺寸。

## 解法

- 优先改用 `mcp__chrome-devtools__emulate` 设置 viewport，例如：

```text
mcp__chrome-devtools__emulate {"viewport":"1440x960x1"}
mcp__chrome-devtools__emulate {"viewport":"393x851x3,mobile,touch"}
```

- 然后再继续 `navigate_page`、`take_snapshot` 或截图相关验收。

## 验证方式

- 首页桌面端检查：`mcp__chrome-devtools__emulate {"viewport":"1440x960x1"}`
- 首页移动端检查：`mcp__chrome-devtools__emulate {"viewport":"393x851x3,mobile,touch"}`

两种视口都已成功完成页面检查，没有再触发 `Browser.setContentsSize` 错误。

## 复现记录

- `2026-04-13 19`：在前端 bootstrap realignment 收尾时，尝试用 `resize_page` 做桌面端 UI 检查首次触发；随后切换为 `emulate.viewport`，桌面端和移动端页面检查均正常完成。
