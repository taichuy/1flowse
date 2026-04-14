---
memory_type: tool
topic: web/app 的 vite dev 监听 3100 端口在当前沙箱内会报 EPERM，需要提权
summary: 在当前环境中从 `web/app` 启动 `pnpm dev --host 127.0.0.1 --port 3100` 时，沙箱内会报 `listen EPERM: operation not permitted 127.0.0.1:3100`；提权后可正常启动并用于本地页面验收。
keywords:
  - vite
  - dev
  - EPERM
  - 3100
  - web/app
match_when:
  - 需要在 `web/app` 启动本地 Vite dev server
  - 监听 `127.0.0.1:3100` 时报 `listen EPERM`
  - 需要用浏览器或 Playwright 检查前端页面
created_at: 2026-04-14 22
updated_at: 2026-04-14 22
last_verified_at: 2026-04-14 22
decision_policy: reference_on_failure
scope:
  - vite
  - web/app
  - 3100
---

# web/app 的 vite dev 监听 3100 端口在当前沙箱内会报 EPERM，需要提权

## 时间

`2026-04-14 22`

## 失败现象

执行：

```bash
pnpm dev --host 127.0.0.1 --port 3100
```

报：

```text
Error: listen EPERM: operation not permitted 127.0.0.1:3100
```

## 触发条件

- 在当前 Codex 沙箱内从 `web/app` 启动 `vite dev`
- 需要监听本地 `3100` 端口做浏览器验收

## 根因

当前沙箱不允许该 dev server 直接绑定本地监听端口。

## 已验证解法

- 使用提权执行同一条 `pnpm dev --host 127.0.0.1 --port 3100`
- 提权后可正常打开 `http://127.0.0.1:3100/style-boundary.html?scene=page.settings` 做页面检查

## 后续避免建议

- 需要浏览器验收 `web/app` 时，默认预期 `vite dev` 可能要提权，不要反复在沙箱内空跑
- 若只是核对代码或单测，优先先跑 `vitest / lint / build`，再决定是否启动本地 dev server
