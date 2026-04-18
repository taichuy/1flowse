---
memory_type: feedback
feedback_category: interaction
topic: 前端 UI 模糊需求先收敛后默认继续实现
summary: 当前端 UI 任务需求模糊、只给图片或外部样本时，AI 应先收敛页面目标和设计需求草案，然后默认直接继续实现，不要求用户先确认；只有阻塞性产品决策时才集中提问。
keywords:
  - frontend
  - ui
  - requirement refinement
  - image reference
  - continue by default
match_when:
  - 前端 UI 需求模糊
  - 用户只给图片、截图、竞品页或外部样本
  - 需要决定是否等用户确认后再实现
created_at: 2026-04-18 16
updated_at: 2026-04-18 16
last_verified_at: 2026-04-18 16
decision_policy: direct_reference
scope:
  - .agents/skills/frontend-development
  - .memory/feedback-memory/interaction
---

# 前端 UI 模糊需求先收敛后默认继续实现

## 时间

`2026-04-18 16`

## 规则

- 当前端 UI 需求模糊、只给图片或外部样本时，先做需求收敛，产出页面目标、借鉴边界和设计需求草案。
- 收敛后默认直接开始实现，不要求用户先确认。
- 只有存在阻塞实现的产品级分歧时，才一次性集中提问。

## 原因

- 这类任务如果不先收敛，容易把参考图直接当需求照搬。
- 但如果每次都停下来等确认，又会拖慢前端 UI 迭代，用户更倾向于看结果后直接打断修正。

## 适用场景

- “按这个图做一个页面”
- “我想要这种感觉”
- 新页面 / UI 调整但输入只有模糊目标或参考图
