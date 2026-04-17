---
memory_type: project
topic: agentflow LLM user prompt 已收敛为模板长文本输入
summary: 用户已明确要求 `LLM` 节点的 `User Prompt` 不再使用简单 selector，而要改成长文本模板输入，并支持在文本中插入上游变量引用。
keywords:
  - agentflow
  - llm
  - user prompt
  - templated text
  - variable insertion
match_when:
  - 后续继续调整 LLM 节点 user prompt 字段
  - 需要判断 User Prompt 应该是 selector 还是模板长文本
created_at: 2026-04-17 16
updated_at: 2026-04-17 16
last_verified_at: 2026-04-17 16
decision_policy: verify_before_decision
scope:
  - web/app/src/features/agent-flow/components/bindings
  - web/app/src/features/agent-flow/components/inspector
  - web/app/src/features/agent-flow/lib
---

# agentflow LLM user prompt 已收敛为模板长文本输入

## 时间

`2026-04-17 16`

## 谁在做什么

- 用户在对照参考图审看 `LLM` 节点详情时，要求把 `User Prompt` 从简单输入/选择器改成模板型长文本输入。
- AI 已把 `User Prompt` 接成模板编辑字段，并补了变量插入、变量引用回显、可见性校验与兼容旧 selector 数据的逻辑。

## 为什么这样做

- `LLM` 的 `User Prompt` 本质上不是单值绑定，而是需要承载多段文本与多个上游变量混写的提示词区域。
- 仅保留 `selector` 或普通 `textarea` 都不足以覆盖真实 authoring 场景。

## 为什么要做

- 让 `LLM` 节点详情更符合实际提示词编排方式。
- 避免用户在 `User Prompt` 场景里被迫用单一变量绑定，或只能手工敲模板 token 而没有插入辅助。

## 截止日期

- 无硬截止；本轮实现后作为当前有效共识。

## 决策背后动机

- `User Prompt` 需要“长文本 + 变量引用”双能力，而不是二选一。
- 现有老文档里的 `selector` 数据要继续可读，不要求一次性迁移。
- 模板文本中的变量引用仍然要参与静态校验，不能因为改成长文本就失去引用可见性检查。

## 关联文档

- `web/app/src/features/agent-flow/components/bindings/TemplatedTextField.tsx`
- `web/app/src/features/agent-flow/components/inspector/NodeInspector.tsx`
- `web/app/src/features/agent-flow/lib/template-binding.ts`
