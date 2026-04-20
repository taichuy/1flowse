---
memory_type: feedback
feedback_category: repository
topic: 质量控制规则应以 AGENTS 为主承载而不是 README
summary: 用户在 `2026-04-20 20` 明确要求，仓库质量控制与验证规则不应主要写在 `README.md`，而应沉淀到对应层级的 `AGENTS.md` 与相关 skill 中；README 最多保留跳转指针，不再作为规范真相源。
keywords:
  - agents
  - readme
  - quality control
  - verification
  - documentation
match_when:
  - 需要新增或调整质量控制说明
  - 需要决定验证入口写在 README 还是 AGENTS
  - 需要沉淀仓库级测试与门禁规则
created_at: 2026-04-20 20
updated_at: 2026-04-20 20
last_verified_at: 2026-04-20 20
decision_policy: direct_reference
scope:
  - AGENTS.md
  - web/AGENTS.md
  - api/AGENTS.md
  - .agents/skills
  - README.md
---

# 质量控制规则应以 AGENTS 为主承载而不是 README

## 时间

`2026-04-20 20`

## 规则

- 仓库质量控制、验证入口和门禁规则应优先写入对应层级的 `AGENTS.md`。
- `README.md` 可以保留简短入口或跳转说明，但不再承载完整质量控制规范。
- 如果质量控制涉及具体评估流程或证据口径，应继续同步到相关 skill。

## 原因

- `AGENTS.md` 才是本仓库对 agent 的稳定本地执行规则入口，和质量控制规则的使用场景一致。
- 把规范主承载放在 `README.md`，容易让 onboarding 文档和执行规则混在一起，后续也更容易漂移。
- 质量控制规则需要分层落到仓库级、前端级和后端级，`AGENTS.md` 更适合按作用域收敛。

## 适用场景

- 新增仓库级验证命令或门禁
- 调整前端或后端质量控制规则
- 需要决定规范类文档落点时
