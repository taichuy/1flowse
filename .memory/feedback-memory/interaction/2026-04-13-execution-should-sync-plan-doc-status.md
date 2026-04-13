---
memory_type: feedback
feedback_category: interaction
topic: 执行既有实现计划后应同步回填计划文档状态
summary: 当用户给出明确 plan 并要求“执行到完成”时，完成实现、验证和提交后，还要同步更新对应计划文档的勾选状态与执行结果，不能只改代码和记忆。
keywords:
  - execution
  - plan
  - documentation
  - status
  - feedback
match_when:
  - 用户要求按现有计划文档执行实现
  - 实现已经完成但计划文档尚未回填状态
  - 需要做任务收尾与执行沟通
created_at: 2026-04-13 15
updated_at: 2026-04-13 15
last_verified_at: 2026-04-13 15
decision_policy: direct_reference
scope:
  - docs/superpowers/plans
  - user interaction
  - execution flow
---

# 执行既有实现计划后应同步回填计划文档状态

## 时间

`2026-04-13 15`

## 规则

- 当用户已经提供明确的实现计划文档并要求直接执行时，完成代码、测试、验证和提交后，必须同步更新对应 plan 文档。
- 至少应回填：
  - 复选框状态；
  - 完成时间或完成状态；
  - 关键验证命令与实际执行备注。

## 原因

- 用户把 plan 文档当作执行入口和完成态记录，如果只改代码不回填 plan，文档状态会和真实仓库状态脱节。
- 后续继续接手同一专题时，未回填的 plan 会让人误判哪些步骤还没做完。

## 适用场景

- 用户明确给出 `docs/superpowers/plans/*.md` 并要求“执行到完成”。
- AI 已经完成实现，需要做收尾同步。

## 备注

- 若执行中存在和原计划不同的实际细节，例如工具限制、额外验证命令或命令需改成完整模块路径，应写入 plan 的执行备注，而不是默默留在对话里。
