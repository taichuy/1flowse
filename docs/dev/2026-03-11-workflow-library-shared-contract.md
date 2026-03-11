# 2026-03-11 Workflow Library Shared Contract

## 背景

在 `workspace starter` 治理第二阶段完成后，创建页和编辑器已经能串起：

- starter 选择
- workflow 进入画布
- 保存版本
- 保存为 workspace starter
- 返回创建页复用

但当前“workflow library”的事实仍然是分裂的：

- `builtin starter`
- `node catalog`
- `source lane`

主要由 `web/lib/*` 常量维护；

- `workspace starter`
- `tool registry`

则由后端 API 提供。

这会带来两个直接问题：

1. 前端在维护第二套“来源分层事实”，后续节点插件注册中心、compat adapter 和 starter 治理继续推进时会反复返工。
2. “应用新建编排 / 节点能力 / 插件兼容” 这些主业务入口虽然在 UI 上已经可见，但它们缺少统一后端 contract，难以成为稳定的共享入口。

## 目标

本轮先完成 `runtime-foundation` 当前 P0 第一项的最小闭环：

- 把 `node catalog / builtin starter / workspace starter / tool source lanes` 收到统一后端 snapshot
- 让创建页和编辑器优先消费这份共享 contract
- 减少前端本地常量对“来源语义”和“库内容事实”的主导

这次不做的内容：

- 节点插件注册中心
- ecosystem starter 真实来源
- workspace starter refresh / rebase / history
- 发布配置或开放 API

## 实现

### 1. 新增 workflow library snapshot API

新增接口：

- `GET /api/workflow-library?workspace_id=default`

当前响应统一提供：

- `nodes`
  - 原生 node catalog
- `starters`
  - builtin starters
  - workspace starters
- `starter_source_lanes`
- `node_source_lanes`
- `tool_source_lanes`
- `tools`

对应文件：

- `api/app/schemas/workflow_library.py`
- `api/app/services/workflow_library.py`
- `api/app/api/routes/workflow_library.py`

### 2. 后端收口 workflow library 的来源语义

本轮把以下来源描述从前端常量转为后端事实：

- `Builtin starter library`
- `Workspace templates`
- `Ecosystem templates(planned)`
- `Native node catalog`
- `Tool registry`
- compat tool lanes

这样创建页和编辑器后续不需要再各自推导：

- 这些 lane 属于什么 scope
- 是否 `available / planned`
- 应该显示什么 label / summary

而是直接消费后端整理好的共享 contract。

### 3. 前端创建页切换到共享 snapshot

`/workflows/new` 不再单独拼装：

- 本地 builtin starters
- workspace starter API
- plugin registry 计数

而是改为读取 `getWorkflowLibrarySnapshot()`，再基于后端返回的 `starters + nodes + source lanes` 构建创建页展示。

对应文件：

- `web/lib/get-workflow-library.ts`
- `web/app/workflows/new/page.tsx`
- `web/components/workflow-create-wizard.tsx`
- `web/lib/workflow-starters.ts`

### 4. 编辑器 palette 切换到共享 node catalog

`/workflows/{workflowId}` 当前也改为通过 `workflow library snapshot` 获取：

- node catalog
- node source lanes
- tool source lanes
- tool list

编辑器不再默认依赖本地 `WORKFLOW_NODE_PALETTE` 常量作为唯一事实来源。

对应文件：

- `web/app/workflows/[workflowId]/page.tsx`
- `web/components/workflow-editor-workbench.tsx`
- `web/lib/workflow-editor.ts`
- `web/lib/workflow-node-catalog.ts`

## 影响范围

### 已改善

- `workflow library` 的核心事实开始从前端常量迁回后端 contract
- 创建页和编辑器对“来源 lane”的理解更一致
- builtin starter 与 workspace starter 终于出现在同一份 API snapshot 中
- 下一步继续接 `plugin-backed node source` 时，有了更自然的后端落点

### 仍未解决

- node catalog 仍然是后端代码内置常量，还没进入节点插件注册中心
- ecosystem starter 仍是规划态 lane，没有真实数据源
- `tool` 仍然只是共享 tool registry，而不是完整的 node/plugin source registry
- `workflow-node-config-form.tsx` 和 `runtime.py` 的体量问题仍需后续专项处理

## 验证

已执行：

- `api/.venv/Scripts/python.exe -m pytest tests/test_workflow_library_routes.py tests/test_plugin_routes.py tests/test_workspace_starter_routes.py`
- `pnpm exec tsc --noEmit`
- `pnpm lint`

结果：

- 新增后端 snapshot 路由测试通过
- 相关插件与 workspace starter 路由回归通过
- 前端类型检查与 lint 通过

## 决策结论

这轮优先做 `workflow library shared contract` 是合理的，因为它同时回答了几个当前最关键的问题：

- 基础框架是否已经能继续推进主业务
  - 可以，但需要减少前端本地事实拼装
- 架构是否足够解耦
  - 方向基本对，但 library source model 之前仍偏前端主导
- 最近提交是否需要衔接
  - 需要，且最自然的衔接点就是把 `workspace starter governance` 接到更统一的共享 contract

## 下一步

1. 继续推进 `workspace starter` 治理第三阶段：`refresh / rebase / history / batch actions`
2. 把共享 `workflow library` 再往后端注册中心推进一层，补 `plugin-backed node source` 与统一 node/tool source contract
3. 优先补主业务高频节点的结构化配置，尤其是 `llm_agent`、`output`、edge `mapping[]`
