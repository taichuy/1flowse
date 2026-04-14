---
memory_type: tool
topic: 浏览器手工验收时 credentialed CORS 不能用通配 Origin
summary: 在本地 `web/app:3100 -> api-server:7800` 手工验收中，`credentials: include` 请求如果返回 `Access-Control-Allow-Origin: *` 仍会被浏览器拒绝；已验证解法是把 CORS 层挂到最终 Router 上，并使用 `mirror_request` 回显请求 origin/method/header。
keywords:
  - chrome-devtools
  - cors
  - credentials
  - api-server
  - browser
match_when:
  - 浏览器里 `fetch` 带 cookie 或 `credentials: include` 时出现 CORS 报错
  - `web/app` 本地开发需要访问 `api-server:7800`
created_at: 2026-04-14 08
updated_at: 2026-04-14 08
last_verified_at: 2026-04-14 08
decision_policy: reference_on_failure
scope:
  - chrome-devtools
  - api/apps/api-server/src/lib.rs
  - web/app
---

# 浏览器手工验收时 credentialed CORS 不能用通配 Origin

## 时间

`2026-04-14 08`

## 失败现象

- 浏览器访问 `http://127.0.0.1:3100` 时，`/api/console/session` 与 `/api/public/auth/providers/password-local/sign-in` 请求虽然已经带上 CORS 头，但仍被拦截。
- 控制台报错为：带凭证请求不能配合 `Access-Control-Allow-Origin: *`。

## 触发条件

- 使用 Chrome DevTools 对本地 console shell 做真实登录或 session restore 验证。

## 根因

- 业务路由最初没有吃到 CORS 层；修正后如果仍使用 `CorsLayer::permissive()`，会返回通配 origin。
- `web` 端默认 `credentials: include`，浏览器规范要求这类请求必须回显具体 origin，不能使用 `*`。

## 解法

- 在 `api/apps/api-server/src/lib.rs` 把 CORS 层挂到最终 `Router` 上，而不是只包 `base_router()`。
- 使用：
  - `allow_credentials(true)`
  - `allow_origin(AllowOrigin::mirror_request())`
  - `allow_methods(AllowMethods::mirror_request())`
  - `allow_headers(AllowHeaders::mirror_request())`
- 额外用路由测试覆盖 `OPTIONS /api/public/auth/providers/password-local/sign-in` 与带 `Origin` 的 `GET /api/console/session`。

## 验证方式

- `cargo test -p api-server _tests::auth_routes::public_auth_sign_in_handles_cors_preflight -- --exact --nocapture`
- `cargo test -p api-server _tests::session_routes::session_route_returns_wrapped_actor_payload_and_csrf_token -- --exact --nocapture`
- 浏览器里同一路径不再报 CORS 阻断，而是能进入真实后端响应阶段。

## 复现记录

- `2026-04-14 08`：手工登录 `http://127.0.0.1:3100/sign-in` 时先因缺失/错误的 CORS 头失败，修正后请求成功到达后端，浏览器不再出现 credentialed CORS 阻断。
