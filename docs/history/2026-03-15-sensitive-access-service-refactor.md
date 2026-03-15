# 2026-03-15 Sensitive Access Service Refactor

## 背景

- `SensitiveAccessControlService` 在补齐 credential gating、context read gating 和 tool invoke gating 后，已经同时承担资源查询、resource matcher、默认策略、审批票据和恢复调度，主文件增长到约 500 行。
- `docs/dev/runtime-foundation.md` 已把它标记为新的治理热点；如果继续在同一个 service 里叠加 publish export、notification worker 和更多 source matcher，后续可扩展性与可审查性都会继续下降。

## 目标

- 在不改变现有 runtime / route / test 行为的前提下，先把敏感访问治理主链拆成可扩展结构。
- 保持 `SensitiveAccessControlService` 的公共 API 不变，让调用方无需跟着改造。
- 为后续 publish export 挂点、notification worker / inbox、policy plug-in 和更多 resource source matcher 预留干净边界。

## 本轮实现

- 新增 `api/app/services/sensitive_access_types.py`，承接错误类型和 bundle / decision dataclass。
- 新增 `api/app/services/sensitive_access_policy.py`，承接默认敏感访问决策矩阵。
- 新增 `api/app/services/sensitive_access_queries.py`，承接资源/请求/票据查询、runtime scope 校验、credential/context/tool matcher，以及 access bundle 复用查询。
- `api/app/services/sensitive_access_control.py` 保留为 mutation + orchestration 入口，聚焦 `create_resource`、`ensure_access`、`request_access`、`decide_ticket`，通过 helper 调用复用查询和策略逻辑。

## 影响范围

- 后端运行时、敏感访问 API、CredentialStore、ToolGateway 和 RuntimeService 继续通过同一个 `SensitiveAccessControlService` 入口访问，不需要改调用约定。
- 敏感访问治理的“查询/匹配/策略/审批恢复”职责边界更清晰，后续继续扩 publish export 和 notification worker 时，新增逻辑不必继续堆回主 service。
- 这轮是结构性收口，不改变当前 `allow / deny / require_approval / allow_masked` 的行为语义。

## 验证

- `api/.venv/Scripts/uv.exe run ruff check api/app/services/sensitive_access_control.py api/app/services/sensitive_access_policy.py api/app/services/sensitive_access_queries.py api/app/services/sensitive_access_types.py`
- `api/.venv/Scripts/uv.exe run pytest -q tests/test_sensitive_access_routes.py tests/test_runtime_sensitive_tool_gateway.py tests/test_runtime_credential_integration.py`
- `api/.venv/Scripts/uv.exe run pytest -q`

结果：上述检查全部通过，全量后端测试为 `237 passed`。

## 后续建议

1. 继续把同一套敏感访问治理挂到 publish export 入口，补齐发布面真实导出控制。
2. 为 notification worker / inbox 增加真实投递与状态回写，而不是只停留在 in-app delivered/pending 占位。
3. 继续收口 credential path 的 `allow_masked`，把“事实等同 allow”推进成真正的 masked / handle 语义。
