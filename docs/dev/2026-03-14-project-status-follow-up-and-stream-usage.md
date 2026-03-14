# 2026-03-14 项目现状续检与流式 usage 补齐

## 背景

- 用户要求重新阅读仓库协作约束、用户偏好、产品设计、技术补充与运行时基线，判断当前项目是否已经具备持续推进产品完整度的基础。
- 同时需要衔接最近一次 Git 提交，确认当前主线是否连续，并在此基础上继续按优先级推进开发。
- `docs/dev/runtime-foundation.md` 在最近几轮连续把两件事列为高优先级：
  - 继续拆 `api/app/services/published_gateway.py`
  - 补流式 `stream_options.include_usage` 支持

## 现状判断

### 1. 上一次提交是否需要衔接

- 需要衔接。最近提交 `9ea1795 refactor: split published gateway binding resolver` 明确属于 publish gateway 结构治理主线，不是孤立重构。
- 其前序提交已依次拆出 response builder、invocation recorder、binding resolver，说明当前主线是持续把 publish gateway 从“大而全服务”收敛为职责边界明确的组件组合。
- 如果本轮不承接该主线，`published_gateway.py` 很容易随着协议兼容和缓存/审计逻辑继续膨胀。

### 2. 基础框架是否已经写好

- 已经具备“继续补产品完整度”的基础框架，不再处于“先问有没有框架”的阶段。
- 当前已落地的关键基础包括：
  - 工作流定义、版本快照、compiled blueprint、published endpoint 基础模型
  - `runs` / `node_runs` / `run_events` 为核心事实源的运行追踪链路
  - 最小 runtime、节点执行支撑、发布网关、发布缓存、调用审计、异步 waiting bridge
  - 前端工作台、publish panel、run diagnostics 等 MVP 骨架
- 但距离“只剩人工逐项做界面设计”还有明显距离，因此本轮不触发人工验收通知脚本。

### 3. 架构是否解耦分离

- 方向正确，且最近几次提交证明解耦在持续发生，不是只停留在设计文档。
- 后端主线基本遵守了 IR 优先、事件流优先、发布层适配边界明确的原则。
- 仍需继续治理的结构热点：
  - `api/app/services/published_gateway.py`
  - `api/app/services/runtime.py`
  - `api/app/services/published_invocation_audit.py`
  - `web/components/run-diagnostics-panel.tsx`

### 4. 是否存在过长文件、需要继续拆分

- 存在，而且已经接近“优先处理”的程度。
- 当前比较明显的热点包括：
  - `api/app/services/runtime.py`（约 766 行）
  - `api/app/services/published_gateway.py`（约 715 行）
  - `api/app/services/published_invocation_audit.py`（约 663 行）
  - `web/components/run-diagnostics-panel.tsx`（约 645 行）
- 这些文件虽然还未触发用户定义的硬阈值，但已经是“职责堆叠热点”，继续补功能前应优先沿边界拆分，而不是继续横向塞逻辑。

### 5. 主要业务是否可以持续推进产品设计目标

- 可以，且应该继续推进。
- 当前缺口主要不是“推不动”，而是需要在推进功能的同时持续控制结构复杂度。
- 因而本轮选择的开发项是：
  1. 继续沿 publish gateway 主线做结构治理
  2. 补齐流式 token usage，为 AI 成本追踪与后续分析铺路

## 本轮实现

### 1. 补流式 `stream_options.include_usage`

- 更新 `api/app/services/llm_provider.py`：
  - OpenAI 流式请求默认追加 `stream_options: {"include_usage": true}`
  - 解析 OpenAI SSE 时支持读取 usage-only chunk
  - `LLMStreamChunk` 新增 `usage` 字段，用于把 usage 从 provider 层上传给 runtime
- 更新 `api/app/services/agent_runtime_llm_support.py`：
  - finalize 流式阶段累计 usage 信息
  - 让流式执行结果不再只保留 `latency_ms`，而是能写入真实 token usage

### 2. 继续拆 `published_gateway.py`

- 新增 `api/app/services/published_gateway_cache_orchestrator.py`
- 将 publish gateway 中的 cache lookup / cache store 编排从主执行链路中抽出，保留 `PublishedEndpointGatewayService` 聚焦于：
  - binding resolve 后的执行决策
  - runtime 调用
  - response / audit 交接
- 这属于纯结构治理，不改变 publish API 契约或缓存语义。

## 影响范围

- `api/app/services/llm_provider.py`
- `api/app/services/agent_runtime_llm_support.py`
- `api/app/services/published_gateway.py`
- `api/app/services/published_gateway_cache_orchestrator.py`
- `api/tests/test_llm_provider.py`
- `api/tests/test_agent_runtime_llm_streaming.py`

## 验证

- `cd api; .\.venv\Scripts\uv.exe run pytest tests/test_llm_provider.py tests/test_agent_runtime_llm_streaming.py tests/test_published_protocol_streaming.py tests/test_published_protocol_async_routes.py tests/test_published_native_async_routes.py tests/test_workflow_publish_routes.py -q`
- 结果：`56 passed`

## 结论

- 当前项目已经具备持续推进产品设计目标的基础框架。
- 当前最需要警惕的不是“没法开发”，而是：
  - publish/runtime/debug 热点继续膨胀
  - 节点配置与调试面板在功能补齐时再次堆成超大组件/服务
- 因此后续仍应坚持“边补能力，边拆热点”的推进方式。

## 下一步规划

1. **P0：继续拆 `api/app/services/published_gateway.py`**
   - 优先补 protocol surface / mapper handoff，避免 publish gateway 再次吸收协议细节
2. **P1：治理 `api/app/services/runtime.py`**
   - 按 graph scheduling / node lifecycle / event emission 边界继续收口
3. **P1：治理 `web/components/run-diagnostics-panel.tsx`**
   - 优先把摘要、时间线、钻取入口分层，避免调试面板成为前端“大组件”
4. **P1：继续补节点配置完整度**
   - 把 provider/model/参数配置从大表单继续拆为可复用配置段
