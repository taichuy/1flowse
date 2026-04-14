---
memory_type: feedback
feedback_category: repository
topic: 所有 AGENTS.md 只写短硬稳的本地规则，不写指导类内容
summary: 编写或修改任意 `AGENTS.md` 时，只保留短、硬、稳定的本地执行规则与约定；不写解释性指导、阶段背景或让模型自行判断的提示，全文控制在 200 行内。
keywords:
  - AGENTS
  - local-rules
  - hard-rules
  - no-guidance
  - concise
match_when:
  - 需要编写或修改任意层级的 `AGENTS.md`
  - 需要判断某段内容是否该进入 `AGENTS.md`
  - 需要收紧目录级 AI 规则文档
created_at: 2026-04-14 11
updated_at: 2026-04-14 11
last_verified_at: 2026-04-14 11
decision_policy: direct_reference
scope:
  - AGENTS.md
  - api/AGENTS.md
  - web/AGENTS.md
---

# 所有 AGENTS.md 只写短硬稳的本地规则，不写指导类内容

## 时间

`2026-04-14 11`

## 规则

- 所有 `AGENTS.md` 的目标是提供短、硬、稳定的本地执行规则。
- 只写约定、规则、边界和统一入口，不写解释性指导、方法论、背景说明或阶段叙事。
- 不写“建议如何判断”“优先考虑什么”“通常应该”这类会把执行留给模型猜的句子。
- 内容必须尽可能精准、清晰、简短，全文不得超过 `200` 行。

## 原因

`AGENTS.md` 的价值是让模型进入目录后立刻拿到可执行边界，而不是继续阅读解释或自行推断。指导类内容会稀释约束强度，增加偏航空间。

## 适用场景

- 新建或重写目录级 `AGENTS.md`
- 评审 `AGENTS.md` 是否混入指导类内容
- 判断某条内容应写进 `AGENTS.md` 还是 skill/spec/代码
