---
memory_type: project
topic: 后端 QA 修复已进入模块 01 实施计划阶段
summary: 用户确认总设计讨论没有原则性问题后，当前后端改为按模块拆分实施计划，先落模块 01 的会话、密码、成员动作与 OpenAPI 收口。
keywords:
  - backend
  - qa
  - module-01
  - session
  - password
  - openapi
match_when:
  - 需要继续编写或执行当前后端 QA 修复的模块 01 实施计划
  - 需要判断专题 B/C 中哪些部分属于模块 01
created_at: 2026-04-13 14
updated_at: 2026-04-13 14
last_verified_at: 2026-04-13 14
decision_policy: verify_before_decision
scope:
  - docs/superpowers/specs/1flowse/2026-04-13-backend-qa-remediation-design.md
  - docs/superpowers/specs/1flowse/modules/01-user-auth-and-team/README.md
  - docs/superpowers/plans/2026-04-13-module-01-user-auth-and-team-qa-remediation.md
  - api
---

# 后端 QA 修复已进入模块 01 实施计划阶段

## 时间

`2026-04-13 14`

## 谁在做什么

用户确认当前后端 QA 总设计稿没有原则性问题，要求把后续落地拆成多个后端实施 plan；当前先整理并执行模块 01 `用户登录与团队接入` 对应的实施计划。

## 为什么这样做

总设计稿覆盖权限闭环、会话闭环、路由与 OpenAPI 收口、运行时状态入口收口等多个独立子问题，直接继续写成一份大 plan 会重新把认证、动态建模和 runtime 混在一起。模块 01 当前只负责用户认证、会话、密码、成员动作和该模块拥有的控制面契约，因此先按模块拆开。

## 为什么要做

这样可以让模块 01 先把 `session_version` 安全闭环、动作路由规范和 OpenAPI 契约修正落地，不需要等待 `state_model/state_data` ACL 与 runtime registry 相关修复准备好，降低后续实现时的串扰。

## 截止日期

当前轮没有单独新增硬截止时间，按模块顺序推进。

## 决策背后动机

核心动机是把“一个总 spec + 多个落地 plan”的决策真正落实到执行入口，让每个模块的 plan 都只覆盖自己负责的稳定边界，并为后续模块 02 及之后的专题修复保留独立推进空间。
