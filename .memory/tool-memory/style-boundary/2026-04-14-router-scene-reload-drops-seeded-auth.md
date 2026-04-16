---
memory_type: tool
topic: style-boundary 的 router scene reload 后会丢失认证种子并跳到 sign-in
summary: 在 `style-boundary` 查看基于 `renderRouterScene` 的场景时，如果页面发生 reload，当前地址通常已被 `history.replaceState` 改成真实业务路由；reload 后不会重新执行 `style-boundary` 的认证种子，页面会跳到 `/sign-in`。应重新打开原始 `style-boundary.html?scene=...` URL 再继续检查。
keywords:
  - style-boundary
  - router-scene
  - reload
  - sign-in
  - auth
match_when:
  - 在 devtools 切换设备仿真后 style-boundary 页面跳到 `/sign-in`
  - 当前地址已经不是 `style-boundary.html?scene=...`
  - 需要继续检查 `page.settings`、`page.me` 或 `page.application-detail` 的样式
created_at: 2026-04-14 21
updated_at: 2026-04-17 07
last_verified_at: 2026-04-17 07
decision_policy: reference_on_failure
scope:
  - style-boundary
  - web/app/src/style-boundary/registry.tsx
  - web/app/src/style-boundary/main.tsx
---

# style-boundary 的 router scene reload 后会丢失认证种子并跳到 sign-in

## 时间

`2026-04-14 21`

## 失败现象

在 chrome devtools 里打开 `style-boundary` 的 router scene 后，切到移动端设备仿真或直接 reload，页面跳到了 `/sign-in`，导致无法继续直接检查目标布局。

## 触发条件

- 当前场景使用 `renderRouterScene(...)`。
- 场景挂载后，地址已经从 `style-boundary.html?scene=...` 被替换成真实业务路由。
- 随后发生页面 reload，例如设备仿真或手动刷新。

## 根因

`web/app/src/style-boundary/registry.tsx` 里的 `renderRouterScene` 会先执行 `seedStyleBoundaryAuth()`，再执行：

`window.history.replaceState({}, '', pathname)`

因此场景初次渲染后，浏览器地址已经变成真实业务路由。此时如果页面 reload，启动入口就不再是 `style-boundary.html?scene=...`，`bootstrapStyleBoundary()` 和场景级认证种子不会重新执行，应用会按真实匿名访问流程跳到 `/sign-in`。

## 解法

1. 不要在已经变成真实业务路由的地址上继续判断 style-boundary 场景是否失效。
2. 直接重新打开原始 `style-boundary` URL，例如：
  `http://127.0.0.1:3100/style-boundary.html?scene=page.settings`
3. 回到场景后再继续做截图、宽度测量或样式检查。

## 验证方式

- 在移动端仿真或手动 reload 后观察到页面跳到 `/sign-in`。
- 重新导航回 `style-boundary.html?scene=...` 后，场景恢复，并可继续量测样式或截图。

## 复现记录

- `2026-04-14 21`：在 `page.settings` 场景切换移动端仿真时复现，重新打开原始 style-boundary URL 后恢复。
- `2026-04-17 07`：在 `page.application-detail` 场景手动 reload 时复现，页面跳到 `/sign-in`；重新打开原始 `style-boundary.html?scene=page.application-detail` 后恢复。
