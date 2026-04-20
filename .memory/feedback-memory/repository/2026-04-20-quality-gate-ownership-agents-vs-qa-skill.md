---
memory_type: feedback
feedback_category: repository
topic: 质量门禁入口保留在 AGENTS，门禁选型与 QA 判断进入 qa-evaluation skill
summary: 质量门禁命令入口仍以各级 AGENTS.md 为真相源；什么时候跑哪条门禁、如何组合门禁、证据是否足以下 QA 结论，应收敛到 qa-evaluation skill，而不是继续堆在 AGENTS.md。
keywords:
  - AGENTS
  - qa-evaluation
  - quality-gate
  - verification
  - ownership
match_when:
  - 需要调整质量门禁文档归属
  - 需要判断某条 QA 规则该写进 AGENTS.md 还是 qa skill
  - 需要整理验证入口与 QA 方法论边界
created_at: 2026-04-20 23
updated_at: 2026-04-20 23
last_verified_at: 2026-04-20 23
decision_policy: direct_reference
scope:
  - AGENTS.md
  - .agents/skills/qa-evaluation
  - .memory/feedback-memory/repository
---

# 质量门禁入口保留在 AGENTS，门禁选型与 QA 判断进入 qa-evaluation skill

## 时间

`2026-04-20 23`

## 规则

- 质量门禁命令入口继续保留在最近作用域的 `AGENTS.md`。
- `AGENTS.md` 只保留短、硬、稳定的本地执行规则与统一入口。
- “当前任务该跑哪条门禁、是否需要组合、证据是否足以下 QA 结论、QA 报告怎么写”收敛到 `qa-evaluation` skill。

## 原因

- 质量门禁命令属于仓库硬规则，应该在进入目录时即可直接命中。
- 门禁选型、组合和证据判断属于 QA 工作流，不适合继续堆在 `AGENTS.md`。
- 把入口和方法论拆开后，规则更稳定，skill 也更容易复用。

## 适用场景

- 重写或收紧仓库级、目录级质量门禁文档时。
- 为 `qa-evaluation` 补充门禁选型、组合或证据规则时。
- 评审 `AGENTS.md` 是否混入 QA 方法论时。
