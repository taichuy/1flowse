---
memory_type: project
topic: 前端 QA 当前结论
summary: `web` 前端在 lint/test/build 和 style-boundary 维度已通过，但正式 UI 仍存在 bootstrap/demo 文案泄露、全局第三方样式覆写边界过宽和首包体积偏大的质量问题。
keywords:
  - frontend
  - qa
  - web
  - ui-quality
  - style-boundary
  - performance
match_when:
  - 需要判断当前 `web` 前端是否达到正式交付质量
  - 需要继续修前端 UI 质量、文案、样式边界或首包性能
  - 需要引用最近一次前端 QA 结论
created_at: 2026-04-13 21
updated_at: 2026-04-13 21
last_verified_at: 2026-04-13 21
decision_policy: verify_before_decision
scope:
  - web
  - web/app/src
  - uploads/frontend-qa
---

# 前端 QA 当前结论

## 时间

`2026-04-13 21`

## 谁在做什么

- 用户要求对当前 `web` 前端做一次质量检查。
- AI 按 `qa-evaluation` 流程完成代码、构建、测试、样式边界和真实页面截图审计。

## 为什么这样做

- 当前 `web` 前端已经从 bootstrap 目录整改进入可运行状态，继续推进前需要确认它是否只是“能跑”，还是已经接近正式前端质量。

## 为什么要做

- 用户对前端质量要求包含 UI 质量、导航语义、目录边界和可维护性，不能只依赖 lint/test 绿灯判断通过。

## 截止日期

- 无硬截止日期；后续是否先修 QA 问题由用户决策。

## 决策背后动机

- 自动化门禁已通过：`pnpm --dir web lint`、`pnpm --dir web test -- --testTimeout=15000`、`pnpm --dir web/app build`、`node scripts/node/check-style-boundary.js all-pages`。
- 真实页面截图表明桌面端和移动端壳层布局基本稳定，但正式 UI 仍暴露 `bootstrap`、`demo`、硬编码用户名和中英混杂文案。
- `web/app/src/styles/globals.css` 仍有裸 `.ant-*` 全局覆写，当前虽未打坏声明边界，但 blast radius 偏大。
- 生产构建产物已出现 `index-*.js` 约 `1.18 MB` 的 chunk 告警，说明后续需要做路由级拆包。

## 关联文档

- `web/AGENTS.md`
- `.agents/skills/qa-evaluation`
- `uploads/frontend-qa`
