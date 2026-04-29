---
memory_type: tool
topic: dev-up 在只有 standalone docker-compose v2 时误报缺少 docker compose
summary: 当前环境有 `/xp/server/docker/docker-compose` v2.33.1，但没有 `docker compose` 插件式子命令；旧版 `dev-up` 只探测 `docker compose version`，导致启动前误报缺少 Compose。已验证解法是让 `resolveComposeCommand` 优先使用 `docker compose`，失败后接受 standalone `docker-compose` v2。
keywords:
  - node
  - dev-up
  - docker compose
  - docker-compose
  - middleware
match_when:
  - `node scripts/node/dev-up.js` 报 `缺少 docker compose 命令`
  - `docker compose version` 失败
  - `docker-compose version` 输出 `Docker Compose version v2.x`
created_at: 2026-04-29 19
updated_at: 2026-04-29 19
last_verified_at: 2026-04-29 19
decision_policy: reference_on_failure
scope:
  - node
  - scripts/node/dev-up.js
  - scripts/node/dev-up/middleware.js
  - docker
---

# dev-up 在只有 standalone docker-compose v2 时误报缺少 docker compose

## 失败现象

执行：

```bash
node scripts/node/dev-up.js
```

报：

```text
[1flowbase-dev-up] 缺少 `docker compose` 命令
```

但本机实际存在：

```bash
docker-compose version
```

输出 `Docker Compose version v2.33.1`。

## 根因

`scripts/node/dev-up/middleware.js` 的 `resolveComposeCommand` 只调用 `docker compose version`，没有探测 standalone `docker-compose` v2。

## 已验证解法

- `resolveComposeCommand` 保持优先使用 `docker compose`。
- 插件式子命令不可用时，继续调用 `docker-compose version`。
- 只接受输出匹配 `Compose version v2.x` 的 standalone Compose，避免把旧版 Compose v1 当作目标环境。

## 验证方式

- `node --test scripts/node/dev-up/_tests/core.test.js`
- `node scripts/node/dev-up.js`
- `node scripts/node/dev-up.js status`

验证结果：中间件 PostgreSQL、frontend、api-server、plugin-runner 均可启动。
