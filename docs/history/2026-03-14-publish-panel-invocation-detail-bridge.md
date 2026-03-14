# 2026-03-14 Publish Panel Invocation Detail Bridge

## 背景

- `344beba feat: add published invocation detail drilldown` 已把后端 invocation detail 契约补齐，但工作流页 publish panel 仍停留在 list card 的浅层信息，前端没有稳定消费 `run / callback ticket / cache` 三类排障事实。
- 结合 `docs/dev/runtime-foundation.md` 的当前规划，这一缺口属于明确的 P0 衔接项；如果不补，发布治理会继续停留在“后端可用、前端难用”的半完成状态。

## 本轮目标

1. 把单次 invocation detail 回接到 workflow publish panel。
2. 保持 7Flows 当前事实源不变，前端只消费后端 detail API，不自行拼装 run / callback / cache 明细。
3. 顺手评估当前基础框架与结构热点，明确下一步应继续推进的优先级。

## 当前实现

- `web/lib/get-workflow-publish.ts`
  - 新增 `PublishedEndpointInvocationDetailResponse` 及相关类型。
  - 新增 `getPublishedEndpointInvocationDetail()`，直接请求 invocation detail API。
- `web/lib/get-workflow-publish-governance.ts`
  - publish governance snapshot 现在除 list/audit 外，还能按当前选中的 invocation 拉取 detail。
- `web/app/workflows/[workflowId]/page.tsx`
  - 新增 `publish_invocation` 查询参数解析。
  - 当存在有效 `publish_binding + publish_invocation` 时，服务端页面会一并拉取该 invocation detail。
- `web/components/workflow-publish-invocation-detail-panel.tsx`
  - 新增独立 detail panel，集中展示：
    - run reference / 状态 / 当前节点 / 时间戳
    - callback tickets
    - cache key / cache entry / inventory entry
    - request / response preview
- `web/components/workflow-publish-activity-panel.tsx`
  - 统一负责构造 detail href，保持筛选条件与当前 binding 上下文。
- `web/components/workflow-publish-activity-panel-sections.tsx`
  - activity list 现在在顶部渲染选中的 invocation detail panel。
- `web/components/workflow-publish-invocation-entry-card.tsx`
  - 原本内联 `<details>` 形式的浅展开，调整为显式“打开 invocation detail”入口，减少卡片职责混杂。

## 项目现状判断

### 1. 基础框架是否设计写好了

- **结论：基础框架已经具备可持续推进条件，但尚未到“框架完成、只剩界面设计”的阶段。**
- 后端已具备：workflow/run/node_run/run_event、发布绑定、调用审计、缓存、回调 ticket、最小 AgentRuntime 与 LLMProvider 接入。
- 前端已具备：工作流页、最小编辑器、run 诊断、publish 治理面板、插件与凭证面板。
- 但仍缺关键完整度：publish 主链路热点治理、流式 usage 成本记录、更多节点配置体验与更稳定的前后端明细衔接。

### 2. 架构之间是否解耦分离

- **结论：主方向是对的，解耦已开始形成，但还存在热点模块。**
- 优点：
  - 发布治理已从 binding list 与 invocation detail 两层契约拆开。
  - AgentRuntime 与 LLM support、PublishedInvocationService 与 audit/types 已出现职责分离。
  - 前端本轮继续复用 detail API，没有在页面层复制后端事实拼装逻辑。
- 风险：
  - `api/app/services/published_gateway.py`
  - `api/app/services/runtime.py`
  - `api/app/services/published_invocation_audit.py`
  - `web/components/run-diagnostics-panel.tsx`
  这些仍属于明显热点，需要继续沿职责边界拆分，避免重新长回 God object。

### 3. 部分代码文件是否太长需要解耦分离

- **结论：是，有明确的下一批治理对象。**
- 当前优先关注：
  1. `api/app/services/published_gateway.py`
  2. `api/app/services/runtime.py`
  3. `api/app/services/published_invocation_audit.py`
  4. `web/components/run-diagnostics-panel.tsx`
  5. `web/components/workflow-editor-workbench.tsx`
- 本轮没有为了“拆而拆”直接动这些文件，而是先补产品完整度更高的 P0 链路；后续应结合功能扩张方向按 mapper / protocol surface / query aggregation / panel section 拆分。

### 4. 主要功能业务是否可以继续推进项目完整度

- **结论：可以，而且现在最适合沿“运行追溯 + 发布治理 + 编辑器体验”三条主线继续补齐。**
- 其中 publish governance 已经从“可发布”推进到“可追踪”；这和产品设计中“可调试、可发布、可追溯”的目标一致。

## 验证

- `pnpm --dir web exec tsc --noEmit`

## 下一步规划

1. **P0：继续拆 `api/app/services/published_gateway.py`**
   - 先按 protocol surface / response builder / audit handoff 分层，避免 publish 主链路再次耦合。
2. **P1：补流式 `include_usage` 成本回传**
   - 把流式 LLM 调用的 token usage 写进统一事实层。
3. **P1：治理前端结构热点**
   - 优先拆 `web/components/run-diagnostics-panel.tsx`，保持调试面板在功能继续扩张时仍可维护。
4. **P1：继续补编辑器与节点配置完整度**
   - 尤其是 provider/model/参数的结构化配置体验。
