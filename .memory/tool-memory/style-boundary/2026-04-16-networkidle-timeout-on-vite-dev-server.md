---
memory_type: tool
topic: style-boundary 校验在 Vite dev server 下不要依赖 networkidle
summary: `check-style-boundary` 在本地 dev server 存在持续连接时，`page.goto(..., waitUntil: "networkidle")` 可能 30 秒超时；改为 `domcontentloaded` 后再等待 `window.__STYLE_BOUNDARY__.ready === true` 更稳定。
keywords:
  - style-boundary
  - playwright
  - networkidle
  - vite
  - timeout
  - ready-flag
match_when:
  - 执行 `node scripts/node/check-style-boundary.js ...` 时卡在 `page.goto`
  - 日志显示 `waitUntil: "networkidle"` 30 秒超时
  - 页面已可访问但 Playwright 迟迟不进入空闲态
created_at: 2026-04-16 11
updated_at: 2026-04-16 11
last_verified_at: 2026-04-16 11
decision_policy: reference_on_failure
scope:
  - scripts/node/check-style-boundary/core.js
  - style-boundary
  - playwright
---

# style-boundary 校验在 Vite dev server 下不要依赖 networkidle

## 时间

`2026-04-16 11`

## 失败现象

执行 `node scripts/node/check-style-boundary.js page page.application-detail` 时，日志报：

- `page.goto: Timeout 30000ms exceeded`
- `navigating to "http://127.0.0.1:3100/style-boundary.html?scene=page.application-detail", waiting until "networkidle"`

## 根因

本地 `dev-up ensure` 拉起的前端服务存在持续连接，页面即使已经可访问，也不一定进入 Playwright 语义下的 `networkidle`。脚本随后本来还会等待 `window.__STYLE_BOUNDARY__.ready === true`，所以 `networkidle` 成了多余且脆弱的前置条件。

## 解法

在 `scripts/node/check-style-boundary/core.js` 中，将：

- `page.goto(url, { waitUntil: 'networkidle' })`

改为：

- `page.goto(url, { waitUntil: 'domcontentloaded' })`

并保留 `await page.waitForFunction(() => window.__STYLE_BOUNDARY__?.ready === true)` 作为真正就绪判定。

## 验证方式

- `node scripts/node/check-style-boundary.js page page.application-detail` => PASS
- `node scripts/node/check-style-boundary.js file web/app/src/features/agent-flow/components/editor/agent-flow-editor.css` => PASS
