# 2026-03-16 run view execution decoupling

## 背景

- `api/app/services/run_views.py` 同时承载 run detail、execution view、evidence view、callback waiting presenter 与 callback ticket serialization。
- `docs/dev/runtime-foundation.md` 已把 `run_trace_views.py / run_views.py` 的 presenter 边界继续治理列为 P1 热点，避免 diagnostics 细节重新堆回单体 service。
- published invocation waiting surface 也维护了一份相近的 callback waiting lifecycle presenter，存在 drift 风险。

## 目标

- 继续沿最近的“薄 facade + helper builder / serializer”路线拆解 run diagnostics presenter 热点。
- 让 execution view 组装逻辑独立演进，同时把 callback waiting lifecycle presenter 变成共享事实，供 run diagnostics 与 published invocation waiting surface 复用。

## 实现

- 新增 `api/app/services/run_view_serializers.py`，统一承接：
  - `serialize_run_event`
  - `serialize_run_artifact`
  - `serialize_tool_call`
  - `serialize_ai_call`
  - `serialize_callback_ticket`
  - `serialize_callback_waiting_lifecycle_summary`
  - `serialize_run_callback_waiting_summary`
- 新增 `api/app/services/run_execution_views.py`，把 execution view 的 callback ticket 查询、summary 聚合、node execution timeline 组装从 `run_views.py` 中拆出。
- `api/app/services/run_views.py` 现在收口为：
  - `serialize_run_detail`
  - `RunViewService.get_execution_view()` facade
  - `RunViewService.get_evidence_view()`
  - evidence 侧 supporting artifact helper
- `api/app/api/routes/published_endpoint_invocation_support.py` 改为复用共享的 `serialize_callback_waiting_lifecycle_summary`，避免 published waiting surface 与 run diagnostics 对同一 checkpoint 语义出现不同解释。

## 影响范围

- `api/app/services/run_views.py`
- `api/app/services/run_execution_views.py`
- `api/app/services/run_view_serializers.py`
- `api/app/api/routes/published_endpoint_invocation_support.py`

## 验证

- `api/.venv/Scripts/uv.exe run pytest -q tests/test_run_view_routes.py tests/test_published_invocation_detail_access.py tests/test_published_native_async_routes.py tests/test_published_protocol_async_routes.py`
- `api/.venv/Scripts/uv.exe run pytest -q`
- `api/.venv/Scripts/uv.exe run ruff check app/api/routes/published_endpoint_invocation_support.py app/services/run_views.py app/services/run_execution_views.py app/services/run_view_serializers.py`

结果：

- 相关回归测试 `11 passed`
- 后端全量测试 `300 passed`
- 本轮改动相关 `ruff check` 通过

## 结论与下一步

- 当前 run diagnostics 的 execution presenter 已不再阻塞 `run_views.py` 继续收口，后续可继续把 run detail presenter 与 evidence view 中更细的 normalization/helper 拆层。
- 下一步优先保持同一方向：继续治理 `run_views.py` 的 evidence side helper、`run_trace_views.py` 的 export/access builder，以及 execution node card 的 security policy explanation 数据承接。
