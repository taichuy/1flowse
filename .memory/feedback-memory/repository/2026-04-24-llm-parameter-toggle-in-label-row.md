---
memory_type: feedback
feedback_category: repository
topic: LLM 参数启用开关位置
summary: LLM 参数表单中控制参数是否发送的开关应放在参数标题行右侧，不应独立占用下一行。
keywords:
  - llm-parameter
  - toggle
  - model-settings
  - agent-flow
match_when:
  - 调整 LLM 节点模型设置里的参数表单布局
  - 调整可选参数的启用开关、标题行、滑杆或输入控件层级
created_at: 2026-04-24 19
updated_at: 2026-04-24 19
last_verified_at: 2026-04-24 19
decision_policy: direct_reference
scope:
  - web/app/src/features/agent-flow/components/detail/fields/LlmParameterForm.tsx
  - web/app/src/features/agent-flow/components/editor/styles/canvas.css
---

# LLM 参数启用开关位置

## 时间

`2026-04-24 19`

## 规则

LLM 参数表单里，“是否启用 / 是否发送该参数”的开关要放在对应参数标题行右侧，与参数名称、说明图标同一行；参数值控件放在标题行下方。不要让启用开关独立占用下一行。

## 原因

启用开关控制的是当前参数自身是否生效，语义上属于参数标题行的状态控制。单独放到下一行会把它误读成参数值控件的一部分，也会拉长紧凑浮层里的扫描路径。

## 适用场景

- LLM 节点模型设置浮层里的参数表单。
- provider 参数 schema 渲染的可选参数行。
- 类似“标题 + 可选状态 + 参数值控件”的紧凑表单布局。

## 备注

本规则不要求调整参数值控件本身的交互；滑杆、输入框、默认值按钮仍留在参数值控件区域。
