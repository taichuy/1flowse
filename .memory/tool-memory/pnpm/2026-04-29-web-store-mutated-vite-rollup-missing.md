---
memory_type: tool
topic: web pnpm store 被篡改导致 Vite/Rollup 缺文件，dev-up 前端启动超时
summary: `node scripts/node/dev-up.js` 前端启动超时，`tmp/logs/web.log` 显示 Vite CLI import 的 `dist/node/cli.js` 缺失；`pnpm store status` 报 `ERR_PNPM_MODIFIED_DEPENDENCY` 且包含 vite/rollup。已验证解法是用真实 Node 执行 `CI=1 pnpm --dir web install --frozen-lockfile --force` 重建依赖，再验证 Vite/Rollup 文件和 dev-up。
keywords:
  - pnpm
  - vite
  - rollup
  - node_modules
  - dev-up
  - frontend
match_when:
  - `node scripts/node/dev-up.js` 报 frontend 启动超时
  - `tmp/logs/web.log` 出现 `Cannot find module ... vite/dist/node/cli.js`
  - `pnpm store status` 报 `ERR_PNPM_MODIFIED_DEPENDENCY`
created_at: 2026-04-29 19
updated_at: 2026-04-29 19
last_verified_at: 2026-04-29 19
decision_policy: reference_on_failure
scope:
  - pnpm
  - web
  - web/node_modules
  - scripts/node/dev-up.js
---

# web pnpm store 被篡改导致 Vite/Rollup 缺文件，dev-up 前端启动超时

## 失败现象

`node scripts/node/dev-up.js` 能启动 Docker 中间件，但前端超时：

```text
[1flowbase-dev-up] frontend 启动超时，请查看日志：.../tmp/logs/web.log
```

`tmp/logs/web.log` 中有：

```text
Error [ERR_MODULE_NOT_FOUND]: Cannot find module '.../vite/dist/node/cli.js'
```

同时 `pnpm --dir web install --frozen-lockfile` 只输出 `Already up to date`，但无法修复缺文件。

## 根因

pnpm store / virtual store 中的包内容已损坏。`pnpm store status` 报：

```text
ERR_PNPM_MODIFIED_DEPENDENCY
```

列表包含 `vite@6.4.2`、`rollup@4.60.1` 等前端启动必需包。

## 已验证解法

使用真实 Node 调 pnpm，避免吃到环境里的 node shim：

```bash
CI=1 /home/taichu/.nvm/versions/node/v24.15.0/bin/node /home/taichu/.nvm/versions/node/v24.15.0/bin/pnpm --dir web install --frozen-lockfile --force
```

随后确认：

```bash
test -f web/node_modules/.pnpm/vite@6.4.2_@types+node@22.19.17_yaml@2.8.3/node_modules/vite/dist/node/cli.js
test -f web/node_modules/.pnpm/rollup@4.60.1/node_modules/rollup/dist/bin/rollup
/home/taichu/.nvm/versions/node/v24.15.0/bin/node /home/taichu/.nvm/versions/node/v24.15.0/bin/pnpm --dir web/app exec vite --version
```

## 验证方式

- `node scripts/node/dev-up.js`
- `node scripts/node/dev-up.js status`
- `curl http://127.0.0.1:3100/`

验证结果：frontend 可监听 `0.0.0.0:3100`。
