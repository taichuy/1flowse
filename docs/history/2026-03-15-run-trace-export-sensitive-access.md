# 2026-03-15 Run Trace Export 敏感导出控制

## 背景

- 2026-03-15 最近一轮提交 `61e4998 refactor: split sensitive access control helpers` 已把敏感访问控制拆成 `policy / queries / types / control` 四层，明确为后续更多拦截点预留干净边界。
- `docs/dev/runtime-foundation.md` 一直把“继续把同一套控制挂到 publish/export 入口”列为 P0 follow-up，但当前代码里 Run API 的 `GET /api/runs/{run_id}/trace/export` 仍未真正接入统一敏感访问控制。
- 这意味着：run trace 已经成为人类排障和导出事实的重要入口，但一旦某次 run 实际触达了敏感 credential / context / tool 资源，导出面仍可能绕过已落地的审批与审计闭环。

## 目标

- 先把 Run API 的 `trace export` 接到现有 `SensitiveAccessRequest / ApprovalTicket / NotificationDispatch` 主链，形成一个真实的人类导出面治理落点。
- 保持实现方式可扩展，不把资源匹配、敏感级别聚合和审批触发继续堆回 `api/app/api/routes/runs.py`。
- 为后续 published surface / publish export 接入同一套治理能力提供可复用模式。

## 实现

1. 新增 `api/app/services/run_trace_export_access.py`
   - 聚合某个 `run_id` 已命中的敏感资源访问记录，计算该 run trace 导出应继承的最高 `sensitivity_level`。
   - 对“实际触达过敏感资源”的 run，懒创建或复用 `workspace_resource` 类型的导出资源，并在需要时自动提升资源敏感级别。
   - 当同一 run 后续命中更高敏级资源时，禁止继续复用旧的 export 放行记录，而是强制重新评估访问决策，避免旧审批结果误放行更高敏导出。
2. 更新 `api/app/api/routes/runs.py`
   - 在 `trace export` handler 上新增 `requester_id` 与 `purpose_text` 查询参数，用于把人类导出动作纳入事实层审计。
   - 调用新 service 做导出前检查；若命中 `require_approval`，返回 `409` 与结构化审批信息；若命中 `deny`，返回 `403`。
   - 正常允许的导出继续复用原有 JSON / JSONL 输出，不改动既有 trace payload 结构。
3. 新增 `api/tests/test_run_trace_export_access.py`
   - 覆盖 L2 run trace 导出进入审批、审批后再次导出通过。
   - 覆盖 L1 run trace 导出自动放行但仍写入 `export` 访问请求，确保导出面也留下审计事实。

## 影响范围

- **安全性**：对已触达敏感资源的 run trace 导出，现已不会再直接绕过敏感访问控制。
- **可扩展性**：`runs.py` 没有继续堆审批逻辑；资源匹配和级别聚合被收进独立 service，后续 published surface / publish export 可参考相同模式演进。
- **兼容性**：不触碰既有 trace 查询与导出格式；未命中敏感资源的 run 维持原有导出行为。
- **可靠性**：审批后的恢复调度仍复用现有 `RunResumeScheduler`，未引入第二套 waiting / resume 语义。

## 验证

- `api/.venv/Scripts/uv.exe run ruff check app/api/routes/runs.py app/services/run_trace_export_access.py tests/test_run_trace_export_access.py`
- `api/.venv/Scripts/uv.exe run pytest -q tests/test_run_trace_export_access.py tests/test_run_routes.py`
- `api/.venv/Scripts/uv.exe run pytest -q`

结果：全部通过，后端全量 `239 passed`。

## 下一步

1. 把同一套导出治理继续挂到 published surface / publish export 主链，而不是只停在 Run API。
2. 补真实 notification worker / inbox，把当前 `in_app` delivered 占位推进为可消费的人工审批触达能力。
3. 把 credential path 的 `allow_masked` 从“事实等同 allow”收成真正的 masked / handle 语义，减少高敏明文继续流入 trace 或 prompt 的风险。
