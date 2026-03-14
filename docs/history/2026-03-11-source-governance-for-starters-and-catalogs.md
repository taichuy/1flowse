# Starter / Catalog 来源治理

## 背景

用户这轮要求先重新阅读：

- `AGENTS.md`
- `docs/dev/user-preferences.md`
- `docs/dev/runtime-foundation.md`
- 最近一次 Git 提交

然后判断几件事：

- 当前基础框架是否已经足够继续推进主业务
- 当前架构是否已经开始解耦
- 哪些文件已经接近需要拆分的体量
- 本轮应该按什么优先级继续开发并补文档

回看上一次提交 `feat: organize workflow starters by business track` 后，确认当前链路已经推进到：

1. starter 可以按四条业务主线筛选
2. 新建页和 editor palette 已经共享 `node catalog`
3. tool catalog 也已接回 editor / binding 链路

但继续往下看，会发现三条来源链仍然是分开的：

- starter template 只知道自己是内置卡片
- node catalog 只知道自己是原生节点
- tool registry 只知道自己来自 `/api/plugins/tools`

如果不先把“这些能力分别来自哪里、由谁治理、哪些已经可用、哪些只是下一步规划”收成共享模型，后续 workspace 模板、plugin-backed catalog、compat 生态入口仍会在前端反复长出重复判断。

## 目标

本轮继续执行 `runtime-foundation` 中的 P0，但只做当前最需要的那一层：

1. 给 starter / node / tool 三类入口补统一的 `source model`
2. 明确区分：
   - 仓库内置 starter
   - 未来 workspace 模板
   - 未来 ecosystem 模板
   - 当前 native node catalog
   - 当前 tool registry / compat tool lanes
3. 把这层来源信息接到创建页和编辑器，而不是继续由页面自己拼字符串

本轮不尝试直接完成：

- workspace 模板持久化
- 后端模板治理 API
- plugin-backed node catalog
- 更深的节点配置抽屉拆分

## 实现

### 1. 新增共享来源模型

新增：

- `web/lib/workflow-source-model.ts`

当前统一定义了：

- `WorkflowLibrarySourceDescriptor`
- `WorkflowLibrarySourceLane`
- starter / node / tool 三类入口共享的来源字段：
  - `kind`
  - `scope`
  - `status`
  - `governance`
  - `ecosystem`
  - `label`
  - `shortLabel`
  - `summary`

同时补上几类当前最关键的来源定义：

- `BUILTIN_STARTER_SOURCE`
- `WORKSPACE_TEMPLATE_SOURCE`
- `ECOSYSTEM_TEMPLATE_SOURCE`
- `NATIVE_NODE_SOURCE`
- `TOOL_REGISTRY_SOURCE`

这一步的重点不是多加几条常量，而是把“入口来源”从页面文案抽出来，成为真正可复用的视图模型。

### 2. Starter library 从“业务主线”继续推进到“来源治理”

更新：

- `web/lib/workflow-starters.ts`
- `web/components/workflow-starter-browser.tsx`
- `web/components/workflow-create-wizard.tsx`

当前 starter 模型不再只保留 `sourceEcosystem: "native"` 这种扁平字段，而是直接挂共享 `source descriptor`。

同时新增：

- `WORKFLOW_STARTER_SOURCE_LANES`

让创建页可以显式展示：

- 当前已有多少 builtin starter
- workspace templates 目前仍是 `planned`
- ecosystem templates 目前仍是 `planned`

这意味着新建入口已经不只是“按业务主线筛选”，而是开始具备“模板来源治理”的基础表达。

### 3. Node catalog 与 tool registry 开始使用同一套来源语义

更新：

- `web/lib/workflow-node-catalog.ts`
- `web/components/workflow-editor-workbench.tsx`

当前原生节点目录已经补上：

- `source: NATIVE_NODE_SOURCE`

同时新增：

- `WORKFLOW_NODE_SOURCE_LANE`
- `summarizePluginToolSources()`

编辑器 palette 区域现在会同时展示：

- 当前 palette 节点来自哪条来源 lane
- 当前已接入多少条 tool source lane
- compat / native tool lanes 的汇总 chip

这样 node catalog 和 tool registry 虽然仍是两条能力来源链，但已经共享一套来源语义，不再靠页面各写各的 `ecosystem` 文案。

## 判断

### 1. 是否需要衔接上一次提交

需要，而且本轮已经直接衔接。

连续关系是：

1. 上一轮把 starter 升级为按主业务线筛选的 `starter library`
2. 这一轮把 starter / node / tool 三条入口继续收敛到共享来源模型

这条链是明确连续的，不是重新开新支线。

### 2. 基础框架是否已经足够支撑主业务继续推进

当前判断：可以。

原因：

- 新建 workflow 的业务入口已存在
- editor 和 recent runs overlay 已存在
- 节点目录、starter、tool binding 都已有真实链路
- 本轮补完来源治理后，下一步 workspace template / plugin-backed source 就有稳定落点

也就是说，当前不是“基础框架还没写完所以不能推进业务”，而是“基础框架已经够用，后续要继续围绕主业务推进”。

### 3. 架构是否解耦

当前方向是对的，但仍是“部分解耦”。

比上一轮更明确的分层：

- `workflow business tracks`
- `workflow source model`
- `workflow starters`
- `workflow node catalog`
- `tool registry summaries`

仍未彻底解开的部分：

- workspace 模板还没有真实数据源
- tool registry 还没有和未来 plugin-backed node source 合成统一后端 contract
- 长文件问题还在，尤其是节点配置表单和 runtime

### 4. 长文件是否仍需要继续盯住

需要，当前排序不变：

1. `api/app/services/runtime.py`
2. `web/components/workflow-node-config-form.tsx`
3. `web/components/workflow-editor-workbench.tsx`

但这轮没有优先拆它们，是因为当前更高优先级仍然是把入口来源模型先收好，否则继续做 workspace 模板和插件化目录仍会重复返工。

## 影响范围

- `web/lib/workflow-source-model.ts`
- `web/lib/workflow-starters.ts`
- `web/lib/workflow-node-catalog.ts`
- `web/components/workflow-starter-browser.tsx`
- `web/components/workflow-create-wizard.tsx`
- `web/components/workflow-editor-workbench.tsx`
- `docs/dev/runtime-foundation.md`

## 验证

已执行：

```powershell
cd web
pnpm lint
pnpm exec tsc --noEmit
```

结果：

- `pnpm lint` 通过
- `pnpm exec tsc --noEmit` 通过

本轮未修改后端代码，因此没有新增后端测试执行。

## 下一步

1. P0：把 `WORKFLOW_STARTER_SOURCE_LANES` 从静态来源状态继续推进到真实的 workspace template 数据源和治理入口。
2. P0：把 node catalog / tool registry 的共享来源模型继续向后端 contract 推进，避免前端单独维护第二套目录分层。
3. P1：继续拆 `web/components/workflow-node-config-form.tsx`，优先围绕 `llm_agent`、`output`、edge `mapping[]` 做结构化分层。
