---
memory_type: tool
topic: Vitest jsdom 中直接读 getComputedStyle 可能漏掉 feature CSS，产生透明背景假阳性
summary: 在 `web/app` 里对通过普通 CSS 文件引入的 feature 样式做 `window.getComputedStyle(...)` 断言时，Vitest + jsdom 可能返回默认值而不是实际渲染值；已验证可复用做法是改用 `style-boundary` 运行时浏览器断言，不把这类视觉样式回归放在 jsdom 单测里。
keywords:
  - vitest
  - jsdom
  - getComputedStyle
  - css
  - style-boundary
  - web/app
  - false-positive
match_when:
  - 在 `web/app` 里给 class CSS 写 `getComputedStyle` 断言
  - 断言结果与实际浏览器渲染不一致
  - 需要验证背景色、阴影、边框、毛玻璃等视觉样式
created_at: 2026-04-15 23
updated_at: 2026-04-15 23
last_verified_at: 2026-04-15 23
decision_policy: reference_on_failure
scope:
  - vitest
  - web/app
  - web/app/src/features/agent-flow/components/editor/agent-flow-editor.css
  - web/app/src/features/agent-flow/_tests/agent-flow-editor-page.test.tsx
  - scripts/node/check-style-boundary.js
---

# Vitest jsdom 中直接读 getComputedStyle 可能漏掉 feature CSS，产生透明背景假阳性

## 时间

`2026-04-15 23`

## 失败现象

在 `web/app/src/features/agent-flow/_tests/agent-flow-editor-page.test.tsx` 里，尝试对 `.agent-flow-editor__overlay` 写：

```ts
window.getComputedStyle(overlay).backgroundColor
```

期望它在当前旧样式下返回 `rgba(255, 255, 255, 0.85)` 并先失败，但 Vitest + jsdom 实际直接返回默认透明值 `rgba(0, 0, 0, 0)`，导致错误断言也会通过。

## 触发条件

- `web/app` 的 `Vitest` + `jsdom`
- 样式来自 feature 目录下的普通 CSS 文件导入
- 断言依赖 `getComputedStyle` 读取背景色、阴影、边框或 `backdrop-filter`

## 根因

当前这类前端单测环境不能稳定代表真实浏览器里的样式应用结果。对视觉样式做 `getComputedStyle` 断言时，可能拿到的是 jsdom 默认值，而不是页面真实 CSS 计算值。

## 解法

1. 不要把这类视觉样式回归放在 jsdom 单测里。
2. 对背景色、阴影、边框、毛玻璃等视觉属性，优先改用 `style-boundary` 运行时浏览器断言。
3. 如果需要给这次改动补回归，直接在 `web/app/src/style-boundary/scenario-manifest.json` 增加对应 selector 的 `propertyAssertions`，再跑：
   - `node scripts/node/check-style-boundary.js page page.application-detail`

## 验证方式

`2026-04-15 23` 已验证：给 `page.application-detail` 增加 `.agent-flow-editor__overlay` 的 `background-color: rgba(0, 0, 0, 0)` 断言后，旧样式先失败，改完 CSS 后 `style-boundary` 通过。

## 复现记录

- `2026-04-15 23`：尝试用 Vitest + jsdom 验证 orchestration 右上角操作栏背景透明，`getComputedStyle(...).backgroundColor` 在旧样式下仍返回透明默认值，产生假阳性；改用 `style-boundary` 后得到真实失败与通过结果。
