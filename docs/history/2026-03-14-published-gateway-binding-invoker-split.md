# 2026-03-14 Published Gateway Binding Invoker Split

## 背景

- 最近一笔 Git 提交 `1b7cbbc` 只是修正文档里的 skills 路径 typo，不涉及运行时代码。
- 上一笔真正的功能提交 `d1e838a` 已把 `published gateway` 的 protocol surface 抽到 `api/app/services/published_gateway_protocol_surface.py`，但主网关仍同时承接 binding 解析、执行、缓存写回、审计落库与限流收口。
- `docs/dev/runtime-foundation.md` 仍把“继续拆 `api/app/services/published_gateway.py`”列为 P0，这一轮需要顺着上次拆分继续往下推进，而不是另起一条偏离主业务闭环的支线。

## 目标

1. 把 publish binding 的统一执行主链从 `PublishedEndpointGatewayService` 再拆一层，避免主服务继续膨胀成 God object。
2. 保持 native / OpenAI / Anthropic 发布入口、缓存语义、审计语义和现有测试行为不变。
3. 顺手修掉一个真实边界问题：已通过 API key 鉴权、但因 streaming 未开启而被拒绝时，审计记录不应丢失 API key 归属。

## 实现方式

### 1. 抽出 binding invoker

- 新增 `api/app/services/published_gateway_binding_invoker.py`。
- 引入 `PublishedGatewayBindingInvoker`，收口以下职责：
  - binding resolve + auth + streaming 开关校验后的统一执行入口
  - cache lookup / store
  - runtime 执行与 run payload 收口
  - invocation success / rejection 审计落库
  - publish rate limit enforcement
- `api/app/services/published_gateway.py` 现在主要保留：
  - service 依赖组装
  - native surface wrapper
  - protocol rejection audit helper
  - 对 invoker 的薄委托

### 2. 抽出 shared gateway types

- 新增 `api/app/services/published_gateway_types.py`。
- 把 `PublishedEndpointGatewayError` 与 `PublishedGatewayInvokeResult` 从主网关文件中抽离，避免新 invoker 与 protocol surface 之间出现循环依赖。

### 3. 修复 streaming rejection 审计的 API key 丢失问题

- `api/app/services/published_gateway_binding_resolver.py` 的 `PublishedGatewayBindingResolverError` 现在可携带 `authenticated_key`。
- 当 binding 已完成 API key 鉴权、但因 `streaming` 未开启而拒绝请求时，resolver 会把已鉴权 key 透传给上层。
- `api/app/services/published_gateway_binding_invoker.py` 在捕获该异常时会把 key 放回 rejection audit context，确保 publish activity / audit facet 能继续正确统计 API key usage。

## 影响范围

- `api/app/services/published_gateway.py`
- `api/app/services/published_gateway_binding_invoker.py`
- `api/app/services/published_gateway_binding_resolver.py`
- `api/app/services/published_gateway_types.py`
- `docs/dev/runtime-foundation.md`

## 验证

- `./api/.venv/Scripts/uv.exe run --directory api ruff check app/services/published_gateway.py app/services/published_gateway_binding_invoker.py app/services/published_gateway_binding_resolver.py app/services/published_gateway_types.py`
- `./api/.venv/Scripts/uv.exe run --directory api pytest tests/test_workflow_publish_routes.py tests/test_workflow_publish_activity.py -q`
- 结果：`28 passed`

## 结论

- 这轮说明当前基础框架已经足够支撑“沿优先级持续推进完整度”，不是停留在空骨架阶段。
- 发布链路的结构治理在连续几轮里保持同一拆分方向，说明后端架构边界总体是解耦可演进的，而不是被协议细节牵着回流。
- 项目仍未到“只剩人工逐项界面设计 / 人工验收”的阶段，因此本轮不触发通知脚本。

## 下一步规划

1. **P0：继续治理 `api/app/services/published_invocation_audit.py`**
   - 优先把 facet / timeline / summary 聚合边界继续拆开，避免 publish governance 热点从 `published_gateway.py` 平移到 audit 聚合文件。
2. **P1：继续治理 `api/app/services/runtime.py`**
   - 沿 graph scheduling / lifecycle / resume orchestration 继续拆分，收紧 RuntimeService 主边界。
3. **P1：继续治理 `web/components/run-diagnostics-panel.tsx`**
   - 继续按摘要、section、drilldown 拆层，避免诊断 UI 把事实接口消费和展示细节重新堆进一个超长组件。
4. **P1：继续补节点配置完整度**
   - 让 provider / model / tool / publish 配置继续朝结构化配置段演进，而不是回退成大表单堆叠。
