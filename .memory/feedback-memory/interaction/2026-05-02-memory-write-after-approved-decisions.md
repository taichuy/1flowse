---
memory_type: feedback
feedback_category: interaction
topic: approved-decisions-memory-write
summary: 用户确认阶段方案、架构方向或执行约束后，spec/plan/commit 不能替代记忆写入；最终回复前必须按记忆触发器补齐对应记忆。
keywords:
  - memory
  - project-memory
  - feedback-memory
  - approved-plan
  - architecture-decision
match_when:
  - 用户确认阶段性方案、架构方向、当前任务边界或执行计划
  - 用户纠正 AI 漏写记忆或询问为什么讨论决策没有进入记忆
  - 已把共识写入 spec、plan 或 commit，但这些共识后续仍需要跨轮复用
created_at: 2026-05-02 08
updated_at: 2026-05-02 08
last_verified_at: 无
decision_policy: direct_reference
scope:
  - .memory
  - docs/superpowers/specs
  - docs/superpowers/plans
---

# 已确认决策必须进入记忆闭环

## 时间

`2026-05-02 08`

## 规则

用户确认阶段性方案、架构方向、任务边界、执行计划或执行约束后，最终回复前必须按 `.memory/AGENTS.md` 的存储触发器维护记忆。`docs/superpowers/specs`、`docs/superpowers/plans` 和 git commit 是工程产物，不能替代 `.memory` 的跨轮检索入口。

判断归类时：

- 长期协作方式、agent 并发限制、沟通偏好写入 `.memory/user-memory.md`。
- 用户对 AI 做法的纠正、边界澄清或认可写入 `feedback-memory`。
- 已批准的阶段方案、架构方向、短期任务状态或计划写入 `project-memory`。
- 一次性实现流水、普通验证输出、可从代码或 git 直接读取的事实不写入记忆。

已有同主题记忆可承载时优先更新旧文件，不重复新建。

## 原因

本轮 runtime event stream 首 token 加速讨论中，AI 把关键决策写入了 spec、plan 和提交记录，但没有同步维护 `.memory`。后续任务启动时通常先读 `.memory`，如果缺少项目记忆和反馈记忆，已确认的架构边界、执行约束和用户纠正就可能被遗漏。

## 适用场景

- 架构讨论收敛后进入 spec / plan / implementation。
- 用户明确说“这样可以”“按照这个来”“计划没问题”“一直到完成”。
- 用户在执行中增加资源、协作、验证或同步记录约束。
- 用户指出 AI 没有按记忆规则沉淀讨论决策。

## 备注

记忆不是任务日志。应只写后续会复用的判断入口，避免把每个 commit、测试输出或临时调试过程沉淀成噪声。
