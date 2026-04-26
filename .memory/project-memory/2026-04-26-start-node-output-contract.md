---
memory_type: project
decision_policy: verify_before_decision
created_at: "2026-04-26 12"
scope: "agent-flow default document"
---

# Start 节点输出契约

2026-04-26，调试“新建应用后进入编排页报 Start node outputs must be empty”时确认：

1. Start 节点的 `outputs` 是持久化禁区，默认文档和保存草稿都不应在 Start 节点上写入 `outputs`。
2. Start 可供下游选择的变量由前端 `config.input_fields` 和内置系统变量 `query/files` 派生，不从 `node.outputs` 读取。
3. 新建应用首次进入编排页时，后端 `domain::default_flow_document()` 必须与前端 `@1flowbase/flow-schema` 的默认文档保持一致：Start `config.input_fields = []`，`outputs = []`。
4. 如后续调整 Start 输入/变量协议，应同步检查后端默认文档、Postgres 首次初始化、API 编排路由返回和前端变量选择器测试。

动机：避免后端默认草稿生成历史旧格式，触发前端 fail-fast 或导致变量契约分裂。
