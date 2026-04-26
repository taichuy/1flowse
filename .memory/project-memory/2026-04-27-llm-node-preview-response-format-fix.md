---
memory_type: project
topic: llm_node_preview_response_format
created_at: 2026-04-27 07
decision_policy: verify_before_decision
scope:
  - api/crates/orchestration-runtime
summary: LLM 节点试运行失败的直接原因是文本模式 response_format 被原样转发给 openai-compatible provider；运行时已改为文本模式不传 response_format。
---

## 谁在做什么？

本轮修复 `1flowbase` 的 LLM 节点单节点试运行。用户提供真实应用、节点 debug-runs URL、模型实例和 payload 后，实际请求确认变量池已经补齐，`{{node-start.query}}` 已渲染为 `你好？你好？`。

## 为什么这样做？

真实失败不是“没有等上游返回”，而是 `config.response_format = {"mode":"text"}` 被运行时原样传给 openai-compatible provider，provider 要求 OpenAI 兼容格式或默认文本输出，因此返回 `Unknown format of response_format`。

## 为什么要做？

LLM 节点试运行应同步阻塞执行当前节点，并在文本返回格式下正常调用 provider。文本模式不需要向 provider 传 `response_format`，省去不兼容的内部 UI 契约字段。

## 截止日期？

已在 2026-04-27 07 修复并验证。

## 决策背后动机？

保持单节点 preview 的 Dify 式定位：不自动跑上游，依赖输入变量池执行当前节点；同时避免把前端内部配置契约泄漏到 provider 协议层。

## 验证事实

- `cargo test -p orchestration-runtime` 通过，17 个测试通过。
- `cargo test -p control-plane start_node_debug_preview` 通过，4 个测试通过。
- 重启本地 `api-server` 后，使用用户提供的 URL 和 payload 真实请求返回 `201`，`flowStatus=succeeded`，`nodeStatus=succeeded`，`renderedUserPrompt=你好？你好？`。
