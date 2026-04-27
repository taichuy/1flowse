---
created_at: "2026-04-27 08"
memory_type: project
decision_policy: verify_before_decision
scope: agent-flow debug console
summary: "整流 Debug Console 已改为提交当前画布 document 快照；Answer 节点默认和详情编辑器改为 templated_text。"
---

# 2026-04-27 Agent Flow Debug Console Document Snapshot

## 谁在做什么

Codex 根据用户反馈修复 Agent Flow 调试控制台和 Answer 节点编辑体验。

## 为什么这样做

节点试运行已经支持请求体 `document` 快照，但整流调试运行此前只提交 `input_payload`，后端会编译数据库中的 draft。用户在当前编排页刚改完提示词、模型配置或 Answer 模板时，调试控制台可能运行旧草稿。

## 做了什么

- `/api/console/applications/{id}/orchestration/debug-runs` 请求体新增可选 `document`。
- `StartFlowDebugRunCommand` 新增 `document_snapshot`，control-plane 编译时优先使用请求快照。
- 前端 Debug Console 发起整流调试时提交当前 `FlowAuthoringDocument`。
- Answer 节点默认绑定改为 `{ kind: "templated_text", value: "{{node-llm.text}}" }`。
- Answer 节点详情字段改用和 LLM Prompt 相同的 `templated_text` 编辑器。
- Debug Console 运行结果映射新增对已持久化 `text_delta` 事件的拼接展示。

## 决策动机

当前阶段优先保证编排页所见即所跑；完整 SSE token-by-token 仍需要后端运行时事件流接口和 provider invocation 增量持久化，不应和本次文档快照修复混成一个大改。
