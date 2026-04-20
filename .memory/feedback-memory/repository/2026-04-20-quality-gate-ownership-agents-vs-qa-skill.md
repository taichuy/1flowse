---
memory_type: feedback
feedback_category: repository
topic: 开发阶段不自动注入质量门禁，QA 阶段由 qa-evaluation 自行选脚本
summary: 开发阶段不需要把完整质量门禁脚本清单放进 AGENTS.md 自动注入；AGENTS.md 只保留开发流程与少量不可变 QA 边界，进入自检、验收、回归或交付阶段后再由 qa-evaluation skill 自行选择并执行脚本。
keywords:
  - AGENTS
  - qa-evaluation
  - quality-gate
  - verification
  - workflow
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

# 开发阶段不自动注入质量门禁，QA 阶段由 qa-evaluation 自行选脚本

## 时间

`2026-04-20 23`

## 规则

- 开发阶段不需要把完整质量门禁脚本清单放进 `AGENTS.md` 自动注入。
- `AGENTS.md` 只保留短、硬、稳定的开发流程规则和少量不可变 QA 边界。
- 进入自检、验收、回归或交付阶段后，再由 `qa-evaluation` 自行选择并执行脚本。

## 原因

- 开发实现和 QA 验收不是同一阶段，不需要把完整测试清单在每次实现时都自动灌进去。
- 门禁选型、脚本执行和证据判断属于 QA 工作流，更适合在 `qa-evaluation` 中统一收敛。
- `AGENTS.md` 回到实现边界和流程约束后，噪声更少，指令更稳定。

## 适用场景

- 重写或收紧仓库级、目录级开发流程文档时。
- 为 `qa-evaluation` 补充脚本选型、执行或证据规则时。
- 评审 `AGENTS.md` 是否混入完整测试清单时。
