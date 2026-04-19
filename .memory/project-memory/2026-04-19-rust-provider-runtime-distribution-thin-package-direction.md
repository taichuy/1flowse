---
memory_type: project
topic: Rust provider 插件分发继续采用 thin package 默认方案
summary: 自 `2026-04-19 22` 起，Rust provider plugin runtime distribution 继续采用“一个逻辑版本，多 target artifact”的默认正式分发方案，不把 win/Linux/mac 多平台二进制一起塞进默认 `.1flowbasepkg`；fat package 只保留为未来可选离线增强，不进入当前正式设计与实现计划。
keywords:
  - plugin
  - rust-provider
  - runtime-distribution
  - thin-package
  - artifact
  - registry
  - fat-package
match_when:
  - 需要继续编写 Rust provider runtime distribution spec
  - 需要判断 .1flowbasepkg 是否默认打成多平台 fat package
  - 需要编写 registry artifact 选择或安装器平台识别方案
  - 需要继续写实现计划
created_at: 2026-04-19 22
updated_at: 2026-04-19 22
last_verified_at: 2026-04-19 22
decision_policy: verify_before_decision
scope:
  - docs/superpowers/specs/1flowbase/2026-04-19-rust-provider-plugin-runtime-distribution-design.md
  - docs/superpowers/plans
  - api
  - scripts
---

# Rust provider 插件分发继续采用 thin package 默认方案

## 时间

`2026-04-19 22`

## 谁在做什么

- 用户在 review `Rust Provider Plugin Runtime And Distribution Design` 时，确认继续采用原先的 thin package 方向。
- AI 需要据此约束后续 spec 修订和实现计划，不再默认展开 fat package 路线。

## 为什么这样做

- 当前目标是让用户安装时无感知平台差异，但不把多平台二进制都塞进默认产物。
- thin package 方案已经满足“逻辑版本统一、安装器自动选 artifact”的产品目标，同时保持 registry、缓存和产物粒度更清晰。

## 为什么要做

- 避免后续实现计划再次在“默认 thin package 还是 fat package”之间摇摆。
- 让 registry、打包 CLI、安装器和 `plugin-runner` 的设计继续围绕“一个逻辑版本，多 target artifact”展开。

## 截止日期

- 未指定

## 决策背后动机

- 默认正式分发固定为：
  - 一个逻辑版本
  - 多个 target artifact
- 默认 `.1flowbasepkg` 不打成包含 win/Linux/mac 全平台二进制的 fat package。
- fat package 如需存在，只能作为未来离线增强能力讨论，不属于当前正式设计与实现计划。
