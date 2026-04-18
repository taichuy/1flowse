---
memory_type: tool
topic: dev-up 预启动会因本地 api-server .env 保留旧品牌默认值而触发 postgres 认证失败
summary: 运行 `node scripts/node/dev-up.js ensure|start --backend-only --skip-docker` 时，如果 `api/apps/api-server/.env` 仍是 `sevenflows/1Flowse` 默认值，`reset_root_password` 会报 `password authentication failed for user "postgres"`；已验证解法是在 `scripts/node/dev-up/core.js` 的 `ensureServiceEnvFile` 中自动迁移旧默认值，并把本地 `.env` 同步到 `1flowbase`。
keywords:
  - node
  - dev-up
  - api-server
  - API_DATABASE_URL
  - postgres
  - password authentication failed
match_when:
  - 运行 `node scripts/node/dev-up.js ensure|start --backend-only --skip-docker`
  - 日志出现 `api-server 开发态重置 root 密码`
  - 随后报 `password authentication failed for user "postgres"`
created_at: 2026-04-18 20
updated_at: 2026-04-18 20
last_verified_at: 2026-04-18 20
decision_policy: reference_on_failure
scope:
  - node
  - scripts/node/dev-up.js
  - scripts/node/dev-up/core.js
  - api/apps/api-server/.env
---

# dev-up 预启动会因本地 api-server .env 保留旧品牌默认值而触发 postgres 认证失败

## 时间

`2026-04-18 20`

## 失败现象

执行 `node scripts/node/dev-up.js` 后，Docker 中间件正常，但 `api-server` 预启动步骤失败：

- `api-server 执行预启动步骤：api-server 开发态重置 root 密码`
- `Error: error returned from database: password authentication failed for user "postgres"`

## 触发条件

- 仓库默认中间件密码和数据库名已经切到 `1flowbase`
- 本地 `api/apps/api-server/.env` 仍保留旧默认值：
  - `API_DATABASE_URL=postgres://postgres:sevenflows@127.0.0.1:35432/sevenflows`
  - `API_REDIS_URL=redis://:sevenflows@127.0.0.1:36379`
  - `API_COOKIE_NAME=flowse_console_session`
  - `BOOTSTRAP_WORKSPACE_NAME=1Flowse`

## 根因

`dev-up` 只会在 `.env` 缺失时从 `.env.example` 拷贝，不会修正已经存在的旧默认值。于是 `reset_root_password` 实际连的是旧数据库名和旧密码，而 Docker 启动的 PostgreSQL 已经使用 `1flowbase/1flowbase`，导致认证失败。

## 解法

- 在 `scripts/node/dev-up/core.js` 中给 `ensureServiceEnvFile` 增加旧品牌默认值迁移逻辑
- 只对 `api-server` 且值仍等于旧默认值的键执行替换，避免覆盖用户自定义配置
- 当前工作区同时把本地 `api/apps/api-server/.env` 同步到 `1flowbase`

## 验证方式

- 运行 `node --test scripts/node/dev-up/_tests/core.test.js`
- 运行 `node scripts/node/dev-up.js ensure --backend-only --skip-docker`
- 预期看到 `reset root password for root`，随后 `api-server` 与 `plugin-runner` 正常启动

## 复现记录

- `2026-04-18 20`：品牌名统一改为 `1flowbase` 后首次启动本地开发环境命中；已通过新增自动迁移逻辑和回归测试验证修复。
