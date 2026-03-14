# 2026-03-14 Published Gateway Response Builder Split

## 背景

- 按 `docs/dev/runtime-foundation.md` 最近一轮的 P0/P1 规划，`api/app/services/published_gateway.py` 仍是发布主链路的结构热点。
- 最近一条产品代码提交 `2a5610d feat: bridge publish panel invocation detail` 已把发布治理前端明细承接起来，因此本轮更适合回到后端主链路治理，避免 publish surface 继续膨胀。
- 当前 `published_gateway.py` 同时承担 protocol surface、主执行编排、响应构建与 invocation audit handoff，虽然行为可用，但边界不够清晰。

## 目标

- 在不改变现有发布行为与 API 契约的前提下，先把“响应构建”从 `PublishedEndpointGatewayService` 主类中剥离。
- 为后续继续按 `protocol surface / response builder / audit handoff` 方向拆分 `published_gateway.py` 预留稳定边界。

## 本轮实现

- 新增 `api/app/services/published_gateway_response_builders.py`：
  - 集中承接 native response payload 构建
  - 集中承接 protocol async response payload 构建
  - 集中承接 response preview 提取与 run payload 提取
- `api/app/services/published_gateway.py` 现在通过注入 `PublishedGatewayResponseBuilder` 复用上述构建逻辑：
  - native publish surface 改为调用 builder
  - OpenAI / Anthropic async publish surface 改为调用 builder
  - cache store 判断与 invocation record 的 run payload 提取改为统一复用 builder
- 这轮没有改动：
  - 发布协议映射契约
  - cache 行为
  - invocation record 结构
  - runtime 执行语义

## 影响范围

- `api/app/services/published_gateway.py`
- `api/app/services/published_gateway_response_builders.py`
- 发布相关 API 路由的运行时行为保持不变，但主服务的职责边界更清晰。

## 验证

- `cd api`
- `./.venv/Scripts/uv.exe run pytest tests/test_workflow_publish_routes.py -q`
- 结果：`24 passed`

## 结论

- 当前项目基础框架已经足够支撑继续推进产品完整度，不需要停下来只做界面设计。
- 上一条提交与本轮是连续衔接的：上一轮补前端 publish detail，本轮回收后端 publish gateway 热点，方向一致。
- 架构仍在朝解耦方向演进，但还没有到“主要框架全部定型、只剩业务填空”的阶段；运行时、发布治理、调试面板仍需继续结构化治理。

## 下一步规划

1. **P0：继续拆 `api/app/services/published_gateway.py`**
   - 优先把 invocation audit handoff 从主执行链路中剥离
   - 再评估 protocol surface 入口是否适合进一步收束到更薄的 façade
2. **P1：补流式 `stream_options.include_usage` 支持**
   - 让流式 LLM 调用也能写入 token usage，补齐成本追踪
3. **P1：治理结构热点**
   - 后端：`api/app/services/runtime.py`
   - 后端：`api/app/services/published_invocation_audit.py`
   - 前端：`web/components/run-diagnostics-panel.tsx`
