# 2026-03-16 Workflow Node Support Status 对齐

## 背景

- `docs/product-design.md` 把 `Loop`、`Sandbox Code` 等节点类型定义为 7Flows IR 的正式组成部分，但当前 runtime 仍未把它们全部接入可执行主链。
- 现有 workflow editor sidebar 只有文案级提示“`loop` 暂不放进画布”，缺少统一的节点级事实模型来表达“类型已进入目录，但当前仍未落地可执行支持”。
- 最近一轮代码与文档评估表明：项目基础框架已经不是空壳，但如果不把“已定义类型”和“当前可执行能力”分开建模，后续继续补节点、插件兼容和 editor 能力时，容易再次踩到“设计已写、UI 看得见、runtime 却跑不动”的诚实性风险。

## 目标

- 给 workflow library 的 node catalog 增加显式支持状态，避免把 palette 可见性误当成能力成熟度。
- 让 editor 在载入包含 planned / unknown node type 的 workflow definition 时，直接给出结构化提示，而不是只靠开发者记忆当前边界。
- 为后续继续补 `loop`、`sandbox_code`、schema builder、capability validation 等工作提供统一元数据入口。

## 实现

### 1. 后端 node catalog 增加支持状态元数据

- 在 `api/app/schemas/workflow_library.py` 为 `WorkflowNodeCatalogItem` 增加 `support_status` 与 `support_summary`。
- 在 `api/app/services/workflow_library_catalog.py` 中把 `sandbox_code`、`loop` 纳入统一 node catalog，但显式标为 `planned`，同时保持 `palette.enabled = False`：
  - `sandbox_code`：说明真实 `sandbox / microvm` adapter 仍在推进；
  - `loop`：说明显式 loop 语义已定，但 MVP executor 仍未支持。
- 这样 `trigger` 也继续保留“`support_status = available` 但不进入 palette”的状态，用于区分“能力已可用”和“编辑器是否允许手动新增”。

### 2. 前端 editor 直接消费支持状态

- 在 `web/lib/get-workflow-library.ts` 把 `supportStatus / supportSummary` 解析进前端 node catalog 类型。
- 在 `web/lib/workflow-node-catalog.ts` 新增：
  - `getPlannedNodeCatalog()`：提取目录里仍处于 `planned` 的节点；
  - `summarizeUnsupportedWorkflowNodes()`：汇总当前 definition 中的 planned / unknown node type。
- 在 `web/components/workflow-editor-workbench.tsx` 统一计算 planned node library 与当前 workflow 的 unsupported node 摘要，并传给 hero / sidebar。
- 在 `web/components/workflow-editor-workbench/workflow-editor-hero.tsx` 与 `web/components/workflow-editor-workbench/workflow-editor-sidebar.tsx` 中补充：
  - planned node types 的明确展示；
  - 当 workflow 已载入未进入执行主链的节点时，直接用错误态提示说明“保留但不可假装已可运行”。

## 影响范围

- 后端契约：`/api/workflow-library` 的 node catalog 响应新增支持状态字段，并把 `sandbox_code`、`loop` 纳入统一目录。
- 前端 editor：工作流编辑器不再只靠静态文案描述节点能力边界，而是根据 catalog 真实元数据渲染 planned / unsupported 提示。
- 架构治理：把“节点类型存在”与“当前是否可执行/可上画布”显式拆开，减少后续扩展时的隐式耦合和误导性展示。

## 验证

- `cd api; .\.venv\Scripts\uv.exe run pytest -q tests/test_workflow_library_catalog.py tests/test_workflow_library_routes.py`
- `cd web; pnpm lint`
- `cd web; pnpm exec tsc --noEmit`

## 结论与下一步

- 这轮改动没有让 `loop` / `sandbox_code` 提前伪装成已完成能力，而是先把支持状态变成可追溯的统一事实；这符合当前 MVP 诚实性和 IR 优先原则。
- 下一步优先顺序：
  1. 把同一套 support status 继续接到 editor 保存前 capability validation，避免用户保存后才在 runtime 失败。
  2. 继续推进 `loop` 与真实 `sandbox / microvm` adapter 的 runtime 主链落地，而不是长期停留在 planned 占位。
  3. 把 node catalog 的支持状态与 publish / diagnostics 的能力提示继续对齐，避免 editor、发布页和运行态各说各话。
