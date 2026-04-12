---
memory_type: project
topic: web UI 探索沙盒固定为可重建 mock-ui 副本
summary: 用户决定把 `tmp/mock-ui` 作为前端 UI 探索目录，通过 Node 脚本从 `web/` 一键重建，并把 mock 副本默认端口固定为 `3210`。
keywords:
  - web
  - mock-ui
  - ui-sandbox
  - port
  - sync-script
match_when:
  - 需要继续维护 `tmp/mock-ui`
  - 需要确认 UI 探索环境如何从 `web` 重建
  - 需要判断 mock 前端默认端口
created_at: 2026-04-13 07
updated_at: 2026-04-13 07
last_verified_at: 2026-04-13 07
decision_policy: verify_before_decision
scope:
  - web
  - tmp/mock-ui
  - scripts/node/mock-ui-sync.js
---

# web UI 探索沙盒固定为可重建 mock-ui 副本

## 时间

`2026-04-13 07`

## 谁在做什么

用户把 `tmp/mock-ui` 定义为专门用于前端设计与 UI 风格反复调试的探索目录。

## 为什么这样做

用户希望从现有 `web/` 快速重建一个独立可运行的前端副本，方便反复重置与试验，而不是直接在主前端里来回试错。

## 为什么要做

这样可以最大化复用现有组件与工程结构，同时降低 UI 实验对主前端开发的干扰。

## 截止日期

无。

## 决策背后动机

选择“重建式同步”而不是“保留本地修改”或“长期双向同步”，是为了让 mock 沙盒保持可预测、可回到干净基线，并把默认前端端口切换到 `3210` 避免与主前端 `3100` 冲突。
