# 2026-03-15 Published Invocation Detail 敏感访问控制

## 背景

- 2026-03-15 最近一轮提交 `d605cef feat: gate sensitive run trace exports` 已把 run trace export 接到统一敏感访问控制主链，但 published 侧的人类详情入口仍可直接查看 invocation request/response preview、callback ticket payload 与 cache preview。
- `docs/dev/runtime-foundation.md` 一直把“继续把同一套控制挂到 published surface / publish export 入口”列为 P0；如果 published governance 面继续裸露详情查看入口，Run API 与 published activity 的安全边界会继续不一致。
- 当前 `api/app/api/routes/published_endpoint_invocation_detail.py` 已成为工作台排障 drilldown 的事实入口之一，适合作为 published 侧第一批真实治理挂点。

## 目标

- 先把 published endpoint invocation detail 接到现有 `SensitiveAccessRequest / ApprovalTicket / NotificationDispatch` 主链，保证人类查看发布调用详情也会进入统一审计与审批语义。
- 避免把“一个 published invocation 关联的 run 曾触达过哪些敏感资源”继续写散在 route 中，为后续 published cache inventory / publish export 继续扩展预留复用边界。
- 尽量不改变现有 published activity 成功响应结构，让已允许的详情查看继续复用现有 UI / API contract。

## 实现

1. 新增 `api/app/services/run_sensitive_access_summary.py`
   - 抽出“按 `run_id` 汇总已命中的最高敏级资源”逻辑，供多个 run-sensitive surface 复用。
   - `run_trace_export_access.py` 改为复用这层，不再各自维护一份敏级聚合逻辑。
2. 新增 `api/app/services/published_invocation_detail_access.py`
   - 以 `published_invocation_detail` 作为 `workspace_resource` 资源种类，把 published invocation detail 映射到统一敏感访问控制。
   - 当 invocation 关联 run 后续触达更高敏级资源时，会自动提升资源敏感级别并强制重新评估，避免旧放行结果误覆盖更高敏详情。
3. 新增 `api/app/api/routes/sensitive_access_http.py`
   - 抽出 access bundle 的 HTTP 序列化与 `409/403` blocking response 生成，避免 `runs.py` 和 published route 继续复制同一套响应拼装逻辑。
4. 更新 `api/app/api/routes/published_endpoint_invocation_detail.py`
   - 新增 `requester_id` 与 `purpose_text` 查询参数，让人类详情查看动作进入统一审计字段。
   - 对关联高敏 run 的 invocation detail，在审批前返回 `409`；被拒绝则返回 `403`；允许访问时维持现有详情结构不变。
5. 新增 `api/tests/test_published_invocation_detail_access.py`
   - 覆盖 L3 published invocation detail 进入审批、审批后再次查看通过。
   - 覆盖 L2 published invocation detail 对 human `read` 自动放行但仍写入访问请求，确保详情查看同样留下治理事实。

## 影响范围

- **安全性**：published activity drilldown 不再天然绕过敏感访问控制；高敏 run 对应的 invocation detail 已进入审批/审计主链。
- **扩展性**：run-sensitive surface 的敏级聚合被抽到共享 helper，后续继续扩 published cache inventory / publish export 时不必再复制一套 run-level 判断。
- **兼容性**：允许访问时不改现有 `PublishedEndpointInvocationDetailResponse`；已有前端面板和已通过请求保持兼容。
- **可维护性**：`runs.py` 也同步复用了新的 HTTP helper，减少了 route 层重复的 access bundle 序列化代码。

## 验证

- `api/.venv/Scripts/uv.exe run ruff check app/api/routes/published_endpoint_invocation_detail.py app/api/routes/runs.py app/api/routes/sensitive_access_http.py app/services/published_invocation_detail_access.py app/services/run_sensitive_access_summary.py app/services/run_trace_export_access.py tests/test_published_invocation_detail_access.py`
- `api/.venv/Scripts/uv.exe run pytest -q tests/test_published_invocation_detail_access.py tests/test_run_trace_export_access.py`
- `api/.venv/Scripts/uv.exe run pytest -q tests/test_workflow_publish_routes.py -k 'published_invocation_detail or cache_entries or published_endpoints'`
- `api/.venv/Scripts/uv.exe run pytest -q`

结果：全部通过；后端全量 `241 passed`。

## 下一步

1. 把同一套治理继续挂到 published cache inventory 与真正的 publish export 入口，而不是只停在 invocation detail drilldown。
2. 补 published 侧的前端 access-blocked / approval-pending 呈现，避免 UI 当前只把 `409/403` 降级成空详情。
3. 继续推进 notification worker / inbox 与 credential path 的真正 masked/handle 语义，补齐统一治理闭环。
