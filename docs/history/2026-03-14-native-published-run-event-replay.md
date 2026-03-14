# 2026-03-14 Native Published Run Event Replay

## 背景

上一轮已经为 native published endpoint 补了最小 replay-style SSE，但事件内容仍然主要来自最终 `output_payload` 的字符串切片。

这会带来一个明显偏差：流式发布表面上有了 `run.started / run.output.delta / run.completed`，但底层仍没有开始复用统一运行事实 `run_events`，离 `docs/dev/runtime-foundation.md` 里下一步的 `run_events -> native / protocol delta` 目标还差一层关键衔接。

## 目标

- 让 native published SSE 优先复用 `RunDetail.events` 中已经持久化的真实 `run_events`。
- 在不改动 runtime 主语义的前提下，把原生流式返回从“只看最终 output”推进到“先回放统一事件，再补最小 output delta”。
- 保持当前 MVP 诚实边界：仍然是 replay-style，而不是假装已经接上实时事件总线。

## 实现方式

1. 在 `api/app/services/published_protocol_streaming.py` 增加 native run event 提取与序列化 helper。
2. `build_native_run_stream()` 现在会优先读取 `response_payload.run.events`：
   - 回放真实的 `run.started / node.started / node.output.completed / run.completed`
   - 如果缺少 `run.started` 或 `run.completed`，再回退到最小兜底事件
3. 为兼容现有 native stream 消费端，仍保留合成的 `run.output.delta`，但它现在位于真实 run event 回放之后、`run.completed` 之前。
4. `run.completed` 事件继续携带最终 `output_payload` 与 `response` envelope，保持原有调用方可用。
5. 增加集成回归，验证 native stream 中已经出现真实 node 级事件，而不是只有最终 output 切片。

## 影响范围

- `api/app/services/published_protocol_streaming.py`
- `api/tests/test_workflow_publish_routes.py`
- `docs/dev/runtime-foundation.md`

## 验证方式

- 在 `api/` 下执行：`./.venv/Scripts/uv.exe run pytest tests/test_workflow_publish_routes.py -q`
- 重点验证：
  - native stream 仍返回 `text/event-stream`
  - 事件序列里已经包含 `node.started` 与 `node.output.completed`
  - 兼容层仍保留 `run.output.delta`
  - 结束事件仍稳定为 `run.completed`

## 当前边界

- 当前 native SSE 只是开始复用已落库的 `run_events`，仍然不是实时事件推送。
- `run.output.delta` 仍是 publish 层合成的桥接事件，不是 runtime 原生写入的 delta 事件。
- OpenAI / Anthropic stream 仍主要依赖协议层 replay，尚未共享这套 native run event 回放逻辑。

## 下一步

1. 继续把 `run_events -> native / openai / anthropic delta` 往统一 mapper 推进，而不是让三种 surface 长出三套流式拼装逻辑。
2. 评估是否在 runtime 中补真实的 `node.output.delta` / `node.output.completed` 双层事件，为协议流式映射提供更直接输入。
3. 如果 publish streaming 继续扩张，优先沿 `stream builder / mapper / route surface` 方向继续拆分，而不是把逻辑重新堆回 `published_gateway.py`。
