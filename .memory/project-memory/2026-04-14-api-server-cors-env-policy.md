---
memory_type: project
topic: api-server 的 CORS 政策按开发与生产环境分流
summary: 用户在 `2026-04-14 08` 确认 `api-server` 的 CORS 采用环境化策略：`API_ENV=development` 默认信任本地开发并放开跨域，`API_ENV=production` 必须显式配置 `API_ALLOWED_ORIGINS`，未配置时启动失败；同时补齐本地与生产两份 `.env` 示例，其中生产模板先给本地 localhost origin 作为显式占位值。
keywords:
  - api-server
  - cors
  - env
  - production
  - development
match_when:
  - 需要修改 `api-server` 的 CORS 行为
  - 需要判断 `API_ALLOWED_ORIGINS` 在何时必填
  - 需要区分本地开发与正式环境的 `.env` 示例
created_at: 2026-04-14 08
updated_at: 2026-04-14 08
last_verified_at: 2026-04-14 08
decision_policy: verify_before_decision
scope:
  - api/apps/api-server/src/config.rs
  - api/apps/api-server/src/lib.rs
  - api/apps/api-server/.env.example
  - api/apps/api-server/.env.production.example
---

# api-server 的 CORS 政策按开发与生产环境分流

## 时间

`2026-04-14 08`

## 谁在做什么

- 用户明确收敛了 `api-server` 的 CORS 环境策略。
- AI 负责把该策略落进配置解析、router 构造和 `.env` 示例文件。

## 为什么这样做

- 本地开发需要允许 `web/app:3100` 到 `api-server:7800` 的带凭证请求，不应每次都手动配白名单。
- 正式环境如果继续沿用开发态的宽松 CORS，会把跨域边界放得过宽。

## 为什么要做

- 需要让开发态“开箱即用”，同时保证生产态必须显式声明允许的控制台域名。
- 配置边界必须体现在 `.env` 示例里，避免部署时靠猜。

## 截止日期

- 无

## 决策背后动机

- `API_ENV` 默认 `development`，减少本地开发的配置噪声。
- `API_ENV=production` 时强制要求 `API_ALLOWED_ORIGINS`，把安全边界前移到启动阶段，而不是让浏览器运行时才发现跨域策略错误。
- `.env.example` 继续承担本地开发默认模板，新增 `.env.production.example` 作为正式环境模板，先放 `http://127.0.0.1:3100,http://localhost:3100` 作为显式占位值，部署时必须替换成真实控制台域名，不影响现有 `dev-up` 种子逻辑。
