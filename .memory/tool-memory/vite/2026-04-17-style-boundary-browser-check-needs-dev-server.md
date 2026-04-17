---
memory_type: tool
tool: vite
topic: style-boundary 浏览器验收不能用 vite preview
summary: 在 `2026-04-17 15` 用 `pnpm exec vite preview --host 127.0.0.1 --port 4173` 打开 `style-boundary.html?scene=...` 时，预览服务返回的是 `index.html` 而不是 `style-boundary.html`，导致 Playwright 一直等不到页面内容；改用 `pnpm exec vite --host 127.0.0.1 --port 4173` 后可正常访问源码入口并完成验证。
keywords:
  - vite
  - preview
  - style-boundary
  - playwright
  - browser verification
match_when:
  - 需要用浏览器打开 `web/app/style-boundary.html`
  - 准备用 Playwright 验证 `style-boundary` 场景
  - `vite preview` 下访问 `style-boundary.html` 却落到 `index.html`
created_at: 2026-04-17 15
updated_at: 2026-04-17 15
last_verified_at: 2026-04-17 15
decision_policy: reference_on_failure
scope:
  - web/app/style-boundary.html
  - web/app/src/style-boundary
---

# style-boundary 浏览器验收不能用 vite preview

## 失败现象

- 使用 `pnpm exec vite preview --host 127.0.0.1 --port 4173`
- 访问 `http://127.0.0.1:4173/style-boundary.html?scene=page.application-detail`
- 返回内容实际是应用 `index.html`
- Playwright 一直等不到 `style-boundary` 场景内的 `节点别名` 等元素

## 原因

- `vite preview` 只服务构建产物 `dist`
- 当前 `style-boundary.html` 是源码入口页面，不在构建产物中

## 已验证解法

- 改用 `pnpm exec vite --host 127.0.0.1 --port 4173`
- 再访问同一个 `style-boundary.html?scene=...` URL
- 可正常加载 `src/style-boundary/main.tsx` 并完成 Playwright 浏览器验证
