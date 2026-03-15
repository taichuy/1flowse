# 2026-03-15 Tool Gateway Sensitive Access

## 背景

- 上一轮 Git 提交 `f0f4857 feat: gate sensitive context reads via approval flow` 已把统一敏感访问控制从 `credential resolve` 扩到了 `mcp_query / authorized_context` 的 context read 主链。
- 但按 `docs/dev/runtime-foundation.md` 的 P0 优先级，这还不算真正闭环：`ToolGateway` 仍缺少同一套敏感访问挂点，direct `tool` node 与 `llm_agent` tool call 还可能绕开统一的 `SensitiveAccessRequest -> ApprovalTicket -> waiting/resume` 主链。
- 本轮目标不是继续补 editor 表单或 UI 壳层，而是把上一轮的治理能力继续接到运行时主链，并顺手修掉 agent waiting checkpoint 的持久化隐患。

## 目标

- 把统一敏感访问控制挂到 `ToolGateway` 的 tool invoke 主链。
- 保持 runtime 仍由 `RuntimeService + ToolGateway + SensitiveAccessControlService` 单一事实链主控，不为 direct tool node 和 `llm_agent` 再造两套审批状态机。
- 为 direct `tool` node 和 `llm_agent` tool call 都补真实测试，验证审批等待与恢复语义一致。

## 本轮实现

### 1. 为 `SensitiveAccessControlService` 增加工具资源匹配

- 新增 `find_tool_resource(...)`，基于 `source=local_capability`、`tool_id`，并支持按 `workflow_id` 优先、全局 fallback 的匹配方式定位受控工具资源。
- 复用 `_workflow_id_for_run(...)`，避免 `workflow_context` 和 tool capability 各自重复解析 run -> workflow scope。

### 2. 把 `ToolGateway.execute()` 接到统一敏感访问控制主链

- `ToolGateway` 现在在真正创建 `ToolCallRecord` 和调用 plugin proxy 之前，先检查当前 tool invoke 是否命中受控 `local_capability` 资源。
- 若决策是 `require_approval`：
  - 不会提前创建 `ToolCallRecord`
  - 直接返回 `ToolExecutionResult(status="waiting")`
  - 把 `resource / access_request / approval_ticket / access_target=tool_invoke` 写进 `node_run.checkpoint_payload["sensitive_access"]`
- 若决策是 `deny`：直接阻断当前工具调用。
- 若决策是 `allow` 或 `allow_masked`：继续走正常 tool invoke；其中 `allow_masked` 当前等同“允许通过受控工具调用能力”，不会把额外高敏原文直接暴露给 AI。

### 3. 让 `ToolGateway` 与 runtime 共用同一个 access service

- `RuntimeService` 现在会把自身持有的 `SensitiveAccessControlService` 实例同时注入 `ToolGateway`。
- 这样 credential gating、context read gating、tool invoke gating 和审批后的 resume dispatch 继续共享同一套 access request / approval ticket / scheduler 事实层。

### 4. 修复 `llm_agent` waiting checkpoint 的 JSON dirty-tracking 丢失

- 在把 `ToolGateway` waiting 结果接入 `llm_agent` 时，暴露出一个旧问题：`AgentRuntime` 会先把 `checkpoint` 赋给 `node_run.checkpoint_payload`，随后继续原地修改同一个 dict；在 JSON 列 dirty-tracking 下，这些后续修改未必可靠落库。
- 本轮把 `AgentRuntime` 的多处 checkpoint 写回统一改成 fresh copy，并在 tool waiting 分支显式同步/清理 `sensitive_access` checkpoint，避免 plan/tool_results/sensitive_access 在 waiting/resume 路径上丢失。

## 影响范围

- `api/app/services/sensitive_access_control.py`
- `api/app/services/tool_gateway.py`
- `api/app/services/runtime.py`
- `api/app/services/agent_runtime.py`
- `api/tests/test_runtime_sensitive_tool_gateway.py`
- `docs/dev/runtime-foundation.md`

## 验证

- `api/.venv/Scripts/uv.exe run pytest -q tests/test_runtime_sensitive_tool_gateway.py`
  - `2 passed`
- `api/.venv/Scripts/uv.exe run pytest -q tests/test_runtime_credential_integration.py tests/test_runtime_service_agent_runtime.py`
  - `20 passed`
- `api/.venv/Scripts/uv.exe run ruff check app/services/agent_runtime.py app/services/runtime.py app/services/sensitive_access_control.py app/services/tool_gateway.py tests/test_runtime_sensitive_tool_gateway.py`
  - `All checks passed`
- `api/.venv/Scripts/uv.exe run pytest -q`
  - `237 passed`

## 当前判断

- 上一轮提交明确需要继续衔接；本轮已经把统一敏感访问控制从 credential/context 主链继续扩到了 `ToolGateway`，direct `tool` node 与 `llm_agent` tool call 不再绕开同一套审批与恢复事实层。
- 当前基础框架仍足够支撑功能性开发、插件兼容演进与可靠性增强，尚未进入“只剩人工界面设计 / 验收”的阶段，因此本轮不触发本地通知脚本。
- 但统一治理能力还没有彻底闭环：publish export、通知 worker / inbox，以及 credential path 的真正 masked/handle 语义仍是下一步关键缺口。

## 下一步

1. 把 publish export / published surface 的高敏导出接到同一套 access request 与 approval 事实层。
2. 为通知 worker / inbox 增加真实投递与状态回收，而不是只停留在事实层记录。
3. 继续治理 `sensitive_access_control.py`、`tool_gateway.py` 和 `runtime_node_dispatch_support.py` 的体量，优先拆 helper，而不是继续堆单体。
