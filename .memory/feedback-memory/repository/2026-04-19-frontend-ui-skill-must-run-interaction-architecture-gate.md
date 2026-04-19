---
memory_type: feedback
feedback_category: repository
topic: frontend-development skill 遇到交互架构决策时必须先跑 interaction architecture gate
summary: 用户确认当前 `frontend-development` skill 在交互设计上做得不够，且 `frontend-logic-design` 很少被触发；后续应把触发条件从“纯信息架构任务”改成“只要存在交互架构决策就先过 gate”。`frontend-development` 作为统一入口，但必须先判断入口、层级、L0/L1/L2/L3、详情容器和同类对象行为规则；命中结构问题时再升级到 `frontend-logic-design`。同时需要用 references、checklist、examples 和 `web/AGENTS.md` 把这条路径写成硬规则，而不是软提示。
keywords:
  - frontend
  - skill
  - interaction architecture
  - gate
  - frontend-development
  - frontend-logic-design
  - trigger conditions
  - examples
  - checklist
match_when:
  - 更新 `frontend-development` skill 的交互设计规则
  - 判断 `frontend-logic-design` 为什么触发率低
  - 设计前端 skill 的入口、层级、详情容器和 L0/L1/L2/L3 触发条件
  - 调整 `frontend-development` 与 `frontend-logic-design` 的职责边界
  - 补充前端 skill 的 gate、示例、checklist 或 `web/AGENTS.md`
created_at: 2026-04-19 00
updated_at: 2026-04-19 00
last_verified_at: 2026-04-19 00
decision_policy: direct_reference
scope:
  - .agents/skills/frontend-development
  - web/AGENTS.md
  - .memory/feedback-memory/repository
---

# frontend-development skill 遇到交互架构决策时必须先跑 interaction architecture gate

## 时间

`2026-04-19 00`

## 规则

- `frontend-development` 仍作为前端实现的统一入口，但不能再把交互设计只当成普通页面细化。
- 只要任务涉及入口、层级、详情容器、`查看全部`、AI 执行落点、`L0 / L1 / L2 / L3` 或同类对象行为统一，就必须先运行交互架构 gate。
- 触发 `frontend-logic-design` 的条件不应再写成“纯信息架构审查”这种窄条件，而应写成：gate 判断问题已经进入结构性设计时立即升级。
- 交互架构 gate 本身应保持薄，只负责触发信号、最小诊断、升级条件和对用户可见的快审模板；不要把 `frontend-logic-design` 全文复制进去。
- `frontend-development` 的 `references`、`review-checklist`、`examples` 和 `web/AGENTS.md` 都要显式反映这条 gate 路径，避免主 skill 提一句但执行时漏掉。
- 示例不只要写“页面结构”和“关键状态”，还要示范首屏主任务、L1 / L2 / L3、反馈落点和一致性规则怎么说。

## 原因

- 当前 `frontend-development` 虽然会谈“页面交互”，但缺少明确的交互架构门槛，导致很多任务被当成普通页面实现直接落代码。
- 现有“纯信息架构审查且尚未进入实现”这个触发口过窄，现实中的前端任务大多是设计和实现混合，结果 `frontend-logic-design` 很少被真正调用。
- 如果不把 gate 写进主 workflow、沟通门槛、复查清单和示例，agent 即使知道有 `frontend-logic-design`，也很容易在实现压力下忽略它。
- 让 `frontend-development` 先做一层交互架构快审，可以在不破坏技能边界的前提下提高触发率，也能让给用户的需求整理更像真正的交互设计，而不是模块罗列。

## 适用场景

- 重构 `frontend-development` skill 的 workflow、trigger、reference 或 example
- 判断某个前端任务是否属于交互架构决策而不是普通页面细化
- 调整 `frontend-development` 与 `frontend-logic-design` 的联动方式
- 补充前端 skill 的 checklist、communication gate 或 `web/AGENTS.md`
- 评估为什么 agent 在前端任务里“会谈交互，但不真正做交互设计”
