---
memory_type: feedback
feedback_category: repository
topic: 流程型 skill 应包含 references 和 examples 目录
summary: 当补充或整理可复用的流程型 skill 时，不应只停留在单个 SKILL.md 或零散 reference 文件；应补成更完整的结构，至少包含 SKILL.md、references/ 和 examples/。
keywords:
  - skill
  - references
  - examples
  - structure
  - repository
match_when:
  - 新增或重构 skill
  - 为 skill 补充流程型能力
  - 需要决定 skill 目录结构是否完整
created_at: 2026-04-18 16
updated_at: 2026-04-18 16
last_verified_at: 2026-04-18 16
decision_policy: direct_reference
scope:
  - .agents/skills
  - .memory/feedback-memory/repository
---

# 流程型 skill 应包含 references 和 examples 目录

## 时间

`2026-04-18 16`

## 规则

- 可复用的流程型 skill 除了 `SKILL.md` 外，应补齐支撑层。
- 至少包含：
  - `references/`：方法论、模板、深入说明
  - `examples/`：示例与压力场景
- 不要只加一份孤立的 reference 文件就算完成。

## 原因

- 单独一份 reference 文件不够完整，后续 agent 不容易系统复用。
- 把方法论、模板和示例拆开后，skill 更好维护，也更容易被后续实例正确触发和使用。

## 适用场景

- 给现有 skill 增加新的流程能力
- 把临时经验沉淀成可复用 skill
- 重构 skill 目录结构
