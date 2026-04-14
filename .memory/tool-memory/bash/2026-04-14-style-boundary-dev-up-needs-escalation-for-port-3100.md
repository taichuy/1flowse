---
memory_type: tool
topic: style-boundary 在沙箱内触发 dev-up ensure 时会因 3100 端口监听失败
summary: 执行 `node scripts/node/check-style-boundary.js file ...` 时会内部调用 `node scripts/node/dev-up.js ensure --frontend-only --skip-docker`；在默认沙箱下会报 `listen EPERM` 无法监听 `3100`，需要提权执行相关命令。
keywords:
  - bash
  - style-boundary
  - dev-up
  - sandbox
  - EPERM
  - 3100
match_when:
  - 运行 `check-style-boundary.js file ...`
  - 运行 `node scripts/node/dev-up.js ensure` 或 `status`
  - 日志里出现 `listen EPERM` 或端口 `3100`
created_at: 2026-04-14 15
updated_at: 2026-04-14 15
last_verified_at: 2026-04-14 15
decision_policy: reference_on_failure
scope:
  - bash
  - node
  - scripts/node/check-style-boundary.js
  - scripts/node/dev-up.js
  - web/app
---

# style-boundary 在沙箱内触发 dev-up ensure 时会因 3100 端口监听失败

## 时间

`2026-04-14 15`

## 失败现象

执行 `node scripts/node/check-style-boundary.js file web/app/src/features/me/pages/MePage.tsx` 时，内部启动流程报 `listen EPERM: operation not permitted 0.0.0.0:3100`，导致 style-boundary 校验失败。

## 触发条件

在默认沙箱里直接执行 `check-style-boundary.js file ...`，或显式执行 `node scripts/node/dev-up.js ensure --frontend-only --skip-docker`。

## 根因

`check-style-boundary.js` 会隐式触发 `dev-up ensure` 来保证前端运行；当前环境下该流程需要监听 `3100` 端口，而默认沙箱不允许这类监听行为。

## 解法

对 `node scripts/node/check-style-boundary.js file ...` 以及 `node scripts/node/dev-up.js status/ensure ...` 使用提权执行；提权后前端、API 和样式边界校验均可正常完成。

## 验证方式

提权运行以下命令后均成功：

- `node scripts/node/check-style-boundary.js file web/app/src/features/me/pages/MePage.tsx`
- `node scripts/node/check-style-boundary.js file web/app/src/features/settings/pages/SettingsPage.tsx`
- `node scripts/node/check-style-boundary.js file web/app/src/shared/ui/section-page-layout/SectionPageLayout.tsx`
- `node scripts/node/dev-up.js status`

## 复现记录

- `2026-04-14 15`：共享壳计划的最终 style-boundary 回归在默认沙箱下因 `3100` 端口监听触发 `listen EPERM`；改为提权执行相关 Node 脚本后通过。
