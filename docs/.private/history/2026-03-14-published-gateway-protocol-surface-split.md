# 2026-03-14 Published Gateway Protocol Surface Split

## 背景

- 按 `docs/dev/runtime-foundation.md` 的当前优先级，`api/app/services/published_gateway.py` 仍是需要继续治理的结构热点。
- 最近两次提交已经先后拆出了 binding resolver 与 cache orchestrator，主网关的协议入口层仍然保留了 OpenAI / Anthropic 的多组 surface 入口方法。
- 这些入口方法本身不承载核心执行语义，职责主要是“协议入口参数整形 + surface 标记 + 响应 builder 选择”，继续堆在主网关里会让发布链路重新膨胀。

## 目标

- 继续沿着 publish gateway 拆层主线推进，把协议 surface 从主网关服务中抽离。
- 保持现有发布 API 契约、缓存语义、运行时语义和测试行为不变。
- 为后续继续拆 protocol mapper handoff / audit hot spot 保留更清晰边界。

## 实现方式

- 新增 `api/app/services/published_gateway_protocol_surface.py`。
- 引入 `PublishedGatewayProtocolSurfaceMixin`，承载以下协议入口：
  - `invoke_openai_chat_completion`
  - `invoke_openai_chat_completion_async`
  - `invoke_openai_response`
  - `invoke_openai_response_async`
  - `invoke_anthropic_message`
  - `invoke_anthropic_message_async`
- `api/app/services/published_gateway.py` 改为继承该 mixin，只保留：
  - native surface 入口
  - 统一 binding invoke 主链路
  - 限流、缓存写回、运行结果收口等核心编排职责

## 影响范围

- `api/app/services/published_gateway.py`
- `api/app/services/published_gateway_protocol_surface.py`
- `docs/dev/runtime-foundation.md`

## 验证

- `cd api; .\.venv\Scripts\uv.exe run pytest tests/test_published_protocol_streaming.py tests/test_published_protocol_async_routes.py tests/test_published_native_async_routes.py tests/test_workflow_publish_routes.py -q`
- 结果：`35 passed`

## 结论

- 当前基础框架已经不是“是否写好了”的阶段，而是进入了沿既定边界持续解耦、补齐完整度的阶段。
- publish gateway 的拆层方向连续几轮都在稳定推进，说明架构并非停留在文档层，而是在逐步落到代码结构。
- 目前仍未到“只剩人工逐项界面设计”的阶段，因此本轮不触发通知脚本。

## 下一步规划

1. **P0：继续拆 `api/app/services/published_gateway.py`**
   - 优先处理 protocol mapper handoff / invocation audit 边界，避免主网关重新聚合协议细节与审计细节。
2. **P1：继续治理 `api/app/services/runtime.py`**
   - 收紧 graph scheduling / lifecycle / resume orchestration 的主服务边界。
3. **P1：继续治理 `web/components/run-diagnostics-panel.tsx`**
   - 按 summary / sections / detail drilldown 进一步拆分，避免调试面板再次长成巨型页面组件。
4. **P1：持续补节点配置完整度**
   - 让 Agent / Tool / Publish 相关配置继续朝结构化配置段演进，而不是堆叠在单一大表单里。
