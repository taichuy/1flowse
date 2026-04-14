---
memory_type: feedback
feedback_category: repository
topic: 子目录 AGENTS 的目录规则必须对齐真实目录和仓库根约束
summary: 更新子目录 `AGENTS.md` 时，目录规则不能只写部分理想结构，必须同时对齐当前真实目录、关键路径命名和仓库根的文件数/行数收纳约束，避免把局部规范写成错误入口。
keywords:
  - AGENTS
  - frontend
  - directory-rules
  - placement
  - repository
match_when:
  - 需要更新子目录 `AGENTS.md` 的目录规则
  - 需要判断目录规范是否和当前代码结构一致
  - 需要把仓库根目录收纳约束下沉到局部 AGENTS
created_at: 2026-04-14 09
updated_at: 2026-04-14 09
last_verified_at: 2026-04-14 09
decision_policy: direct_reference
scope:
  - web/AGENTS.md
  - AGENTS.md
---

# 子目录 AGENTS 的目录规则必须对齐真实目录和仓库根约束

## 时间

`2026-04-14 09`

## 规则

- 子目录 `AGENTS.md` 的目录规则必须优先对齐当前真实存在的目录和关键路径命名，不能把不存在或写错的路径当成规则入口。
- 如果该子目录已经有稳定目录，如 `state/`、`styles/`、`test/`、`packages/*`，规则中应明确其职责边界；不要只写一部分理想结构。
- 仓库根已经明确的目录收纳约束，例如单目录文件数和单文件行数阈值，应在高频子目录 `AGENTS.md` 中下沉成局部硬规则，避免 AI 只看到局部规范时遗漏。

## 原因

`web/AGENTS.md` 原先目录规则只覆盖了部分前端结构，且把 `app/src/styles/globals.css` 写成了错误路径，导致规范和当前代码布局不完全一致，也没有把仓库根的目录收纳阈值带下来。

## 适用场景

- 重写或收紧某个子目录的 `AGENTS.md`
- 为已有工程补目录落点规则
- 检查局部规范是否会把 AI 引到错误路径或遗漏真实目录
