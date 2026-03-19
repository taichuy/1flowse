# 2026-03-11 Workflow Library Workspace Tool Scoping

## 背景

上一轮已经把 `workflow library snapshot` 变成创建页和 editor 的共享后端 contract，但继续对照当前实现后，会看到两个明显缺口：

1. `GET /api/workflow-library?workspace_id=...` 虽然带了 workspace 参数，`tools` 和 `tool_source_lanes` 却还没有真正尊重 compat adapter 的 workspace scope。
2. `tool` 节点虽然在文案里已经表达“可绑定 native / compat tool catalog”，但 node catalog 本身还没有把“它依赖哪些来源 lane”显式写出来。

如果这两层不先补上，后续继续推进 `plugin-backed node source`、节点插件注册中心和开放调用时，前端仍会被迫额外猜测：

- 当前 workspace 到底能看到哪些 compat 工具
- 某个节点究竟是纯 native node，还是依赖外部目录与 compat adapter 的 plugin-backed node

## 目标

本轮继续推进 `runtime-foundation` 的 P0 第一项，但只补当前最需要的这一层：

1. 让 shared `workflow library snapshot` 真正按 `workspace_id` 过滤 adapter 绑定的 compat 工具。
2. 让 node catalog 开始显式返回 plugin-backed binding contract，至少先覆盖 `tool` 节点。
3. 让 editor 直接消费这层事实，而不是继续在页面里临时推断。

本轮不尝试直接完成：

- 动态节点插件注册中心
- ecosystem starter 真实数据源
- 发布配置与开放 API
- 更深的 `tool` / edge mapping 结构化表单

## 实现

### 1. Workflow library 开始尊重 workspace 级工具可见性

更新：

- `api/app/services/workflow_library.py`

当前 `list_tool_items()` 会在共享 snapshot 中执行 workspace 过滤：

- `native` 工具继续全局可见
- 未绑定 adapter 的 compat/plugin 工具继续按全局目录对待
- 绑定了 adapter 的 compat 工具，会按 adapter 的：
  - `enabled`
  - `workspace_ids`
  过滤可见性

这让 `/api/workflow-library?workspace_id=...` 不再只是名字上有 workspace 参数，而是开始真正体现“当前工作空间可消费的工具目录”。

### 2. Tool 节点显式带出 binding source lanes

更新：

- `api/app/schemas/workflow_library.py`
- `api/app/services/workflow_library.py`

`WorkflowNodeCatalogItem` 新增：

- `binding_required`
- `binding_source_lanes`

当前 `tool` 节点会把经过 workspace 过滤后的 `tool_source_lanes` 直接挂进 node catalog：

- native tool registry lane
- compat adapter lane，例如 `compat:dify`

这意味着 editor 不需要再通过“节点类型 = tool，所以它大概依赖 plugin registry”做隐式推断，而是可以直接消费后端明确给出的 node/tool source contract。

### 3. Editor palette 开始显示 plugin-backed node 事实

更新：

- `web/lib/get-workflow-library.ts`
- `web/components/workflow-editor-workbench.tsx`
- `web/components/workflow-editor-workbench/workflow-editor-sidebar.tsx`

当前 editor 左侧 palette 新增了几类信号：

- node source lanes chip
- `Plugin-backed` 节点计数
- 节点卡片上的 binding lane 摘要

这样在同一块 UI 中可以同时看到：

- 这是不是 native node catalog 的节点
- 这个节点是否还依赖 tool registry / compat adapter
- 当前 workspace 实际有哪些 binding 来源可选

## 影响范围

### 已改善

- shared `workflow library snapshot` 开始真实体现 workspace 级 compat adapter 可见性。
- `tool` 节点首次显式带出 plugin-backed binding contract，而不是只靠描述文案。
- editor palette 对 node source / tool source 的展示边界更清楚，后续接动态 node source 时更容易继续演进。

### 仍未解决

- `binding_source_lanes` 当前只覆盖 `tool` 节点，未来节点插件、provider-backed node 还没接进来。
- `node_source_lanes` 本身仍主要反映 native node catalog，还没有独立的节点插件 lane。
- workflow editor 目前仍默认读取 `workspace_id=default` 的 snapshot，尚未接真实 workspace 上下文。
- `workflow_library.py` 已增长到约 639 行，后续若继续接 adapter health、node plugin registry 和 ecosystem starter，应优先拆 source assembly 与 starter builders。

## 验证

已执行：

- `api/.venv/Scripts/python.exe -m pytest api/tests/test_workflow_library_routes.py api/tests/test_plugin_routes.py api/tests/test_plugin_registry_store.py`
- `pnpm exec tsc --noEmit`
- `pnpm lint`

结果：

- 后端新增 workspace scope 与 binding source contract 测试通过
- 相关插件路由与 registry store 回归通过
- 前端类型检查与 lint 通过

## 决策结论

这轮优先做 `workflow library` 的 workspace tool scoping 和 node binding contract 是合理的，因为它直接回答了当前最现实的几个问题：

- 最近一次真正有业务内容的 Git 提交是否需要衔接
  - 需要，但不应继续只沿 workspace starter 单线深化；更自然的衔接点是把 shared workflow library 继续补到 workspace / plugin-aware
- 当前基础框架是否足够继续推进主业务
  - 可以，而且现在“应用新建编排 -> editor -> tool binding”之间的共享 contract 更真实了
- 当前架构是否已经开始解耦
  - 是，但还处于“shared contract 初步成立、plugin-backed node source 刚接入第一层”的阶段

## 下一步

1. 继续把 `workflow library snapshot` 推进到更完整的 plugin/node source contract，补 adapter health/scope 摘要、未来节点插件 lane 和更明确的 node/plugin binding 边界。
2. 回到 workspace starter 第三阶段治理，补批量结果钻取、模板审阅反馈和更清晰的团队决策提示。
3. 继续补高频节点的结构化配置，优先 `tool`、edge `mapping[]`、`runtimePolicy.join` 和输入输出 schema。
