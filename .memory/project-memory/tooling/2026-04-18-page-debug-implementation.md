---
memory_type: project
topic: page-debug 已完成实现并通过真实烟测
summary: 自 2026-04-18 11 起，`scripts/node/page-debug.js` 与 `scripts/node/page-debug/*` 已完成实现，覆盖 CLI、root 登录、页面稳定态、证据采集与 snapshot 重写，并已通过 `node:test` 与 `login/snapshot/open` 真实烟测。
keywords:
  - page-debug
  - implementation-complete
  - playwright
  - snapshot
  - smoke-test
match_when:
  - 需要确认 page-debug 是否已经实现完成
  - 需要知道 page-debug 该如何验证
  - 需要继续扩展 page-debug 脚本
  - 需要知道 /settings 当前在开发态实际跳转到哪里
created_at: 2026-04-18 11
updated_at: 2026-04-18 11
last_verified_at: 2026-04-18 11
decision_policy: verify_before_decision
scope:
  - scripts/node/page-debug.js
  - scripts/node/page-debug/
  - docs/superpowers/plans/2026-04-18-page-debug.md
---

# page-debug 已完成实现并通过真实烟测

## 时间

`2026-04-18 11`

## 谁在做什么

- 用户已选择 `Inline Execution`。
- AI 已按计划完成 `page-debug` 五个任务，并逐任务提交。

## 为什么这样做

- 需要让开发者或 AI 只给一个前端路由，就能自动拿 root 登录态、打开受保护页面、等待到稳定态，并输出可复用证据目录。

## 为什么要做

- 降低页面排查时的手工登录与证据采集成本。
- 让后续 AI 调试可直接消费 `storage-state.json`、`meta.json`、`index.html`、截图和控制台日志。

## 截止日期

- 无

## 决策背后动机

- 实现采用 `cli wrapper + core/auth/readiness/evidence/snapshot + node:test` 的拆分，不把 Playwright、认证、快照逻辑堆进单文件。
- 真实烟测中发现 `waitForUrl + waitForSelector` 场景会过早校验 URL，已通过 `page.waitForURL(...)` 先等待 URL 收敛修复。
- 当前开发态下，`/settings` 实际会归一化到 `http://127.0.0.1:3100/settings/docs`，不再是早期计划里的 `/settings/members`。
- 已验证命令包括：
  - `rtk node --test scripts/node/page-debug/_tests/core.test.js scripts/node/page-debug/_tests/auth.test.js scripts/node/page-debug/_tests/readiness.test.js scripts/node/page-debug/_tests/evidence.test.js scripts/node/page-debug/_tests/snapshot.test.js`
  - `rtk node scripts/node/page-debug.js login`
  - `rtk node scripts/node/page-debug.js snapshot /settings --wait-for-url http://127.0.0.1:3100/settings/docs --wait-for-selector '[data-testid="section-page-layout"]'`
  - `rtk node scripts/node/page-debug.js open /me/profile --wait-for-selector '[data-testid="section-page-layout"]'`
