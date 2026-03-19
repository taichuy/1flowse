# 2026-03-14 Published Gateway Binding Resolver Split

## 背景

- 最近两次提交连续围绕 `api/app/services/published_gateway.py` 做结构治理：
  - `0b4542d refactor: split published gateway response builders`
  - `c42f6a8 refactor: split published gateway invocation recorder`
- 这说明上一轮主线不是新增协议能力，而是持续把 publish gateway 从“大而全”服务收回到清晰职责边界。
- 当前仓库的基础框架已经足够继续推进产品完整度，不需要推翻重来；更现实的优先级是沿现有 IR / runtime / publish gateway / editor skeleton 继续补闭环，并持续拆热点文件。

## 本轮目标

- 继续承接发布治理 P0，先把 published gateway 内部的 binding resolution / auth / workflow resource preload 预检链路抽离出来。
- 保持发布 API 契约、运行语义、缓存策略与 invocation 持久化结构不变，只做结构收口。

## 实现

- 新增 `api/app/services/published_gateway_binding_resolver.py`：
  - 统一处理 protocol 校验
  - 统一处理 `internal` / `api_key` 鉴权
  - 统一装载 `workflow` / `workflow_version` / `compiled_blueprint`
  - 对外暴露 `PublishedGatewayResolvedBinding` 结果对象
  - 复用 invocation repository 统计最近调用次数，避免 rate limit 逻辑继续直连主服务内部细节
- 更新 `api/app/services/published_gateway.py`：
  - 构造函数注入 `PublishedGatewayBindingResolver`
  - `_invoke_binding(...)` 改为先拿 resolver 输出，再进入 cache / runtime / response builder 主链路
  - 将 resolver 抛出的结构化错误映射回现有 `PublishedEndpointGatewayError`，保持上层路由与测试稳定

## 影响范围

- `api/app/services/published_gateway.py`
- `api/app/services/published_gateway_binding_resolver.py`
- `docs/dev/runtime-foundation.md`

## 验证

- `cd api; .\.venv\Scripts\uv.exe run pytest tests/test_workflow_publish_routes.py tests/test_published_native_async_routes.py tests/test_published_protocol_async_routes.py -q`
- 结果：`29 passed`

## 当前判断

- **是否需要衔接上一提交：需要。** 最近提交明显处于同一条发布治理主线，本轮继续拆 binding resolver 是自然承接，不是另起炉灶。
- **基础框架是否已写好：是，且已达到可持续推进阶段。**
  - 后端已有 workflow compiler、runtime、publish gateway、tool/plugin runtime、artifact/context 基础骨架。
  - 前端已有 editor workbench、publish governance、run diagnostics、starter library 等工作台骨架。
- **架构是否在解耦：方向正确，但仍有热点。**
  - publish gateway 正在持续解耦。
  - runtime / invocation audit / diagnostics panel 仍偏集中，需要继续拆。
- **是否还能持续推进产品完整度：可以，而且应该继续按主线推进。** 当前更缺“闭环能力补齐 + 热点治理”，不是缺一个全新的总框架。

## 下一步规划

1. **P0：继续拆 `api/app/services/published_gateway.py`**
   - 优先抽离 protocol surface / cache orchestration，避免 publish gateway 重新膨胀。
2. **P1：补流式 `stream_options.include_usage` 支持**
   - 让 `AICallRecord` 与后续成本分析拿到完整 token usage。
3. **P1：治理剩余结构热点**
   - `api/app/services/runtime.py`
   - `api/app/services/published_invocation_audit.py`
   - `web/components/run-diagnostics-panel.tsx`
4. **P1：继续补节点配置完整度**
   - 把 provider / model / 参数配置进一步结构化，避免重新堆回单一表单组件。
