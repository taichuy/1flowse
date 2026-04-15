---
memory_type: tool
topic: web/app 启动 Vite 命中 3100 端口占用时先复用现有同仓库进程
summary: 为执行 `style-boundary` 回归手动启动 `pnpm dev --host 127.0.0.1 --port 3100` 时，如果报 `Port 3100 is already in use`，先检查占用者是否是当前仓库 `web/app` 的现有 `vite`；若是，不要先杀进程，直接继续执行 `node scripts/node/check-style-boundary.js ...`，脚本内部的 `dev-up ensure --frontend-only` 可复用该实例完成回归。
keywords:
  - vite
  - dev
  - 3100
  - port in use
  - style-boundary
match_when:
  - 手动启动 `pnpm dev --host 127.0.0.1 --port 3100`
  - 输出 `Port 3100 is already in use`
  - 需要继续执行 `style-boundary` 页面回归
created_at: 2026-04-15 11
updated_at: 2026-04-15 11
last_verified_at: 2026-04-15 11
decision_policy: reference_on_failure
scope:
  - vite
  - web/app
  - scripts/node/check-style-boundary.js
  - scripts/node/dev-up
---

# web/app 启动 Vite 命中 3100 端口占用时先复用现有同仓库进程

## 时间

`2026-04-15 11`

## 失败现象

执行：

```bash
pnpm dev --host 127.0.0.1 --port 3100
```

返回：

```text
error when starting dev server:
Error: Port 3100 is already in use
```

## 为什么当时要这么做

- 需要按模块 `03` 的计划执行 `page.home` 与 `page.application-detail` 两个 `style-boundary` 页面回归。
- 这些回归依赖本地前端服务监听 `http://127.0.0.1:3100`。

## 为什么失败

- `3100` 已经被一个现有 `node .../vite.js` 进程占用。
- 该占用进程的 `cwd` 是当前仓库 `web/app`，说明它就是同仓库的前端开发服务，而不是外部无关进程。

## 已验证解法

1. 先用 `lsof -iTCP:3100 -sTCP:LISTEN -n -P` 与 `readlink -f /proc/<pid>/cwd` 确认占用者是否为当前仓库 `web/app` 的 `vite`。
2. 若确认是同仓库进程，不要先手动杀掉它。
3. 直接运行：

```bash
node scripts/node/check-style-boundary.js page page.home
node scripts/node/check-style-boundary.js page page.application-detail
```

4. `check-style-boundary` 内部会调用 `dev-up ensure --frontend-only`，可复用该已有前端实例并正常完成回归。

## 后续避免建议

- 为 `style-boundary` 验收准备前端服务时，先查 `3100` 是否已有当前仓库的 `vite` 在运行。
- 只要占用者是当前仓库实例，优先直接跑 `check-style-boundary`，不要先做多余的重启或清进程。
- 只有确认占用者不是当前仓库实例，或者 `check-style-boundary` 实际无法通过时，再考虑替换进程。

## 复现记录

- `2026-04-15 11`：为执行模块 `03` 的 `style-boundary` 回归，手动启动 `pnpm dev --host 127.0.0.1 --port 3100`，命中端口占用；确认监听者为同仓库 `web/app` 的 `vite` 后，直接执行两条 `check-style-boundary` 命令，均返回 `PASS`。
