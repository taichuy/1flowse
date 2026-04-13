---
memory_type: feedback
feedback_category: repository
topic: 前端样式边界检测应优先真实渲染而不是静态扫描写法
summary: 设计前端样式边界检测时，不能只靠静态 selector 扫描；应优先采用独立宿主和无头浏览器做运行时回归，支持单组件、页面和文件影响面检测，避免测试退化成重型 E2E。
keywords:
  - frontend
  - style-boundary
  - runtime
  - browser
  - qa
match_when:
  - 需要设计前端样式覆盖检测或 UI 质量门禁
  - 需要判断静态扫描还是运行时回归更适合
  - 需要给组件提供可脱离业务路由的测试入口
created_at: 2026-04-13 14
updated_at: 2026-04-13 14
last_verified_at: 2026-04-13 14
decision_policy: direct_reference
scope:
  - scripts/node
  - web/app/src/style-boundary
  - .agents/skills/frontend-development
  - .agents/skills/qa-evaluation
---

# 前端样式边界检测应优先真实渲染而不是静态扫描写法

## 时间

`2026-04-13 14`

## 规则

- 前端样式边界检测不应只做 selector 或写法扫描。
- 应优先通过独立宿主和无头浏览器做真实渲染回归。
- 必须支持单组件场景，避免因为权限、后端或完整路由依赖而把样式测试推高成重型 E2E。
- 文件级检测应映射到显式维护的受影响场景，而不是主观猜测。

## 原因

静态扫描只能抓“写法像坏味道”，不能证明真实渲染是否被打坏。未来页面接入权限、后端和更复杂状态后，如果没有独立组件宿主，想打开一个组件做验证会越来越困难，最终迫使样式回归退化成昂贵且脆弱的全链路测试。

## 适用场景

- 设计或实现前端样式边界检测脚本
- 讨论前端 UI 质量门禁的自动化执行方式
- 为共享组件、导航、菜单、壳层等高风险样式改动设计回归方案
