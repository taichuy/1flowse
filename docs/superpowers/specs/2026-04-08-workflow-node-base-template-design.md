# Workflow Node Base Template 设计说明

## 1. 背景

当前 workflow editor 里的“节点”其实分散在两套实现里：

- 画布卡片壳层由 `web/components/workflow-editor-workbench/workflow-canvas-node.tsx` 直接渲染。
- 右侧详细面板由 `web/components/workflow-editor-inspector.tsx` 分别挂载
  `WorkflowEditorNodeSettingsPanel` 与 `WorkflowEditorNodeRuntimePanel`。

这导致节点的共同结构没有被稳定抽出来：

- 画布卡片上的标题、图标、状态、试运行、删除、quick-add 都是节点共有能力，但当前直接写死在单组件里。
- 右侧面板里的参数设置、输入摘要、输出摘要、试运行、runtime 反馈，本质上也是节点共有骨架，但 `startNode` 和其它节点已经开始分叉。
- `startNode` 当前同时承担“最简单节点”和“特殊节点”两个角色，结果是运行时表单、contract 编辑和结果展示都混在专用分支里，不利于后续让 `endNode`、`condition/router`、`tool`、`agent`、`sandbox` 继续收口。

用户目标不是只给 `startNode` 做模板，而是把“节点基类”建立起来：所有节点最终都应共享同一套卡片壳、详细面板壳和 runtime 骨架；节点差异只落在专属配置表单、节点说明和少量特性插槽上。

## 2. 目标与非目标

### 2.1 目标

- 为所有节点建立统一的画布卡片模板。
- 为所有节点建立统一的右侧详细面板模板，覆盖：
  - 参数设置
  - 上游输入 / 当前试运行输入
  - 输出与最近一次运行结果
  - runtime 状态摘要
  - contract 编辑入口
- 让 `startNode` 成为第一个完全迁移到统一模板的节点实例，而不是继续保留专用大分支。
- 保持当前单节点试运行语义不变，继续使用现有 `runs / node_runs / run_events` 事实链路。
- 为后续逐步收口 `endNode`、`condition/router`、`tool`、`agent`、`sandboxCodeNode` 提供现实可用的迁移路径。

### 2.2 非目标

- 不修改后端 trial-run API、run overlay API 或 runtime 数据模型。
- 不在本轮重做 inspector 的整体信息架构，保留当前 `设置 / 运行时 / AI` tab 结构。
- 不在本轮引入新的全局状态库、节点 DSL 或复杂 registry 基础设施。
- 不把 `/runs`、published detail、独立 diagnostics 页直接并入同一 UI 组件，只复用同一运行事实与展示骨架。

## 3. 当前实现问题

### 3.1 画布层

`workflow-canvas-node.tsx` 现在同时负责：

- 节点颜色与图标
- 标题、副标题、描述
- 试运行按钮
- 删除按钮
- quick-add
- handle 显隐
- runtime 状态 class

这已经是标准“节点壳层”职责，但没有被抽成壳组件，后续如果某些节点要调整头部布局、状态角标或公共按钮区，就只能继续在一个组件里堆条件分支。

### 3.2 右侧面板层

`WorkflowEditorInspector` 目前把节点细节拆成两个彼此独立的组件：

- `WorkflowEditorNodeSettingsPanel`
- `WorkflowEditorNodeRuntimePanel`

这样的问题是：

- 节点的公共骨架没有统一入口，导致“设置”和“运行时”各自发展。
- `startNode` 的 contract 编辑被放进 runtime panel，而普通节点的 contract 编辑在 settings panel 里，信息结构已经不一致。
- 非 `startNode` 节点的 runtime 面板只显示试运行输入 + 最近 run 的 JSON，`startNode` 则又多一套独立 modal、缓存和运行状态 strip，重复与分叉都在增加。

### 3.3 模板语义缺失

当前代码里没有一个明确的“节点模板定义”来描述：

- 这个节点共用哪个卡片壳
- 这个节点在 settings tab 里哪些 section 是公共的，哪些是特有的
- 这个节点在 runtime tab 里如何展示上游输入、试运行输入、结果输出与运行状态

结果是节点类型差异只能靠 JSX 里的 `if (nodeType === "startNode")` 扩散。

## 4. 选定方案

采用“统一节点入口组件 + 双层共享壳 + 节点模板定义”的渐进方案。

### 4.1 方案概述

本次不做“大而全的 BaseNode 巨型组件”，而是建立三个清晰层级：

1. `WorkflowNodeCardShell`
   - 统一画布节点卡片壳。
2. `WorkflowEditorNodePanel`
   - 统一右侧节点详细面板入口。
3. `WorkflowNodeTemplateDefinition`
   - 只描述节点差异，不接管整套渲染。

### 4.2 为什么不选其它方案

- 不选“只抽 `startNode` 专用模板”
  - 只能缓解一个节点，不会形成全节点统一骨架。
- 不选“单个超大 BaseNode 全包”
  - 会把画布壳、settings、runtime、节点差异都塞进一个组件，后续条件分支只会更重。
- 不选“重型 registry/store 重构”
  - 当前仓库还没有必要引入更重的节点渲染基础设施，这会超过本轮目标。

## 5. 目标结构

### 5.1 画布层：统一卡片壳

新增 `WorkflowNodeCardShell`，把当前 `WorkflowCanvasNode` 改成“数据适配器 + 壳组件”关系。

壳层统一负责：

- 节点头部布局
- 图标 / label / type meta
- runtime 状态 class 与状态装饰
- 试运行按钮
- 删除按钮
- quick-add 区域
- incoming / outgoing handle

每种节点只提供最小差异数据，例如：

- `accentColor`
- `glyph`
- `supportsDelete`
- `supportsQuickAdd`
- `supportsRuntimeAction`
- `description`

这样 `WorkflowCanvasNode` 本身退化成“把 `WorkflowCanvasNodeData` 映射到模板壳”的薄适配层。

### 5.2 Inspector 层：统一节点面板入口

新增 `WorkflowEditorNodePanel`，由它统一生成节点的两个 tab：

- `设置`
- `运行时`

`WorkflowEditorInspector` 不再直接分别拼装 `WorkflowEditorNodeSettingsPanel` 与 `WorkflowEditorNodeRuntimePanel`，而是只挂 `WorkflowEditorNodePanel`。

`WorkflowEditorNodePanel` 内部再复用两个共享壳：

- `WorkflowNodeSettingsTemplate`
- `WorkflowNodeRuntimeTemplate`

共享壳负责定义统一 section 顺序与布局，节点模板只负责提供差异 slot。

### 5.3 节点模板定义：最小差异对象

引入最小 `WorkflowNodeTemplateDefinition`，只描述节点差异，不承载运行状态本身。

定义至少覆盖：

- 画布展示元信息
  - 图标
  - accent color
  - 描述提取方式
- settings tab 的特性区块
  - 专属配置表单 renderer
  - 是否显示通用 contract section
  - 是否显示通用 runtime policy section
- runtime tab 的差异配置
  - 是否有上游输入摘要
  - 是否允许直接试运行
  - 试运行输入来自哪里的 schema
  - 结果区是否展示“最近 node run input/output”
  - 节点专属提醒文案

这不是为了做未来大抽象，而是为了把当前已经散落在 `startNode` 分支和普通节点分支里的差异显式集中。

## 6. 统一模板下的节点模型

### 6.1 所有节点共有的稳定结构

所有节点都共享下列稳定结构：

- 画布卡片
  - 标题
  - 类型信息
  - 状态
  - 常用动作
- 设置面板
  - 节点特性配置区
  - contract 区
  - runtime policy 区
  - 原始 JSON 区
- 运行时面板
  - runtime 摘要
  - 输入区
  - 试运行区
  - 输出区

这里的“输入区”和“试运行区”语义不同：

- 输入区
  - 展示这个节点从工作流视角可接收什么输入，以及上游关系如何。
- 试运行区
  - 展示这次单节点调试时，用户实际提交了什么 payload。

### 6.2 `startNode` 如何成为第一个样板

`startNode` 与其它节点的差异仅保留为：

- 没有上游输入摘要
- settings tab 的特性区是 trigger 输入字段编辑器
- runtime tab 的试运行输入直接来自当前 trigger schema
- 允许复用当前的缓存 payload / modal 启动逻辑

但以下部分改为走统一模板：

- runtime 摘要卡
- 输入 / 输出结果展示
- contract section 容器
- 运行时错误与 loading 区
- inspector section 布局

这意味着 `startNode` 不再拥有单独一整套 runtime 面板骨架，只保留最少特性插槽。

### 6.3 其它节点如何逐步并轨

首轮不要求把所有节点行为完全重做，但要求它们都改挂到统一模板：

- 非 `startNode`
  - settings 特性区继续使用现有 `WorkflowNodeConfigForm`
  - runtime 输入区展示“上游摘要 + 本次试运行 payload”
  - 输出区继续显示最近一次 node run input/output JSON
- `endNode`
  - 暂时仍可显示简化的 settings 特性区，但壳层与 runtime 摘要保持统一
- `condition/router`
  - 首轮沿用通用试运行壳，后续再逐步细化结构节点自己的提示和输入说明

也就是说，本轮先统一壳，再一点点调整节点特性，不要求一次性把所有节点的业务细节做到位。

## 7. 组件拆分与职责

建议采用如下组件边界：

- 新增：`web/components/workflow-editor-workbench/workflow-node-card-shell.tsx`
  - 纯画布节点壳。
- 新增：`web/components/workflow-editor-inspector-panels/workflow-editor-node-panel.tsx`
  - 统一节点详细面板入口。
- 新增：`web/components/workflow-editor-inspector-panels/workflow-node-settings-template.tsx`
  - settings tab 共享骨架。
- 新增：`web/components/workflow-editor-inspector-panels/workflow-node-runtime-template.tsx`
  - runtime tab 共享骨架。
- 新增：`web/components/workflow-editor-inspector-panels/workflow-node-template-definition.ts`
  - 节点模板差异定义与 resolver。

原有组件的调整方向：

- `workflow-canvas-node.tsx`
  - 保留数据映射与事件绑定，UI 主体迁到 `WorkflowNodeCardShell`。
- `workflow-editor-node-settings-panel.tsx`
  - 不再自己定义整页结构，收敛为 settings 特性区 renderer 集合。
- `workflow-editor-node-runtime-panel.tsx`
  - 不再自己拥有完整 runtime 布局，收敛为 runtime 行为与 startNode 特性逻辑。
- `workflow-editor-inspector.tsx`
  - 只挂统一 `WorkflowEditorNodePanel`。

## 8. 数据流与运行语义

### 8.1 不变的事实源

本次仍沿用现有事实源：

- 单节点试运行触发：`triggerWorkflowNodeTrialRun`
- 运行详情：`run`
- 节点详情：`run.node_runs`
- 事件摘要：`run_events` / trace 映射后的 `runStatus`、`runEventCount`、`runLastEventType`

统一模板只改变前端表达，不改变后端真实语义。

### 8.2 runtime 模板的数据输入

通用 runtime 模板从以下数据源组合：

- 当前节点定义
- 当前 selected run
- 当前 node run
- 当前节点 input schema / output schema
- 当前节点上下游信息
- 节点模板 definition

模板根据 definition 决定：

- 输入区展示“无上游 / 有上游摘要”
- 是否渲染试运行输入表单
- 是否弹 modal
- 是否显示 contract section

### 8.3 诚实边界

单节点试运行仍保持当前诚实语义：

- 对非 `startNode` 节点，不自动补齐整个 workflow 的真实上游 context。
- 运行时面板必须继续明确提示“这里只提供本次试运行的直接输入”。
- 统一模板不能假装结构节点、结束节点已经拥有完整的业务专属调试能力；首轮只统一骨架与公共信息结构。

## 9. 迁移顺序

### 9.1 第一阶段：建立壳层

- 抽出 `WorkflowNodeCardShell`
- 抽出 `WorkflowEditorNodePanel`
- 让 inspector 从“双组件直挂”切到“统一节点面板入口”

### 9.2 第二阶段：迁移 `startNode`

- 把 `startNode` 的 settings/runtime 接到统一模板
- 保留其 modal、payload cache、launch mode 等特性逻辑
- 去掉 `startNode` 在 runtime 骨架上的专用大分支

### 9.3 第三阶段：迁移普通节点

- 把当前非 `startNode` 节点的 settings/runtime 区块迁到统一模板 slot
- 用同一 runtime 摘要、输入区、输出区壳层承接

### 9.4 第四阶段：逐个细化结构节点

- `endNode`
- `conditionNode`
- `routerNode`
- 其它节点

这一阶段只做节点特性细化，不再动基类结构。

## 10. 测试与验证

至少补充或调整以下验证：

- 画布节点壳
  - 选中态下动作区仍正常显示
  - `startNode` 不显示删除
  - `endNode` 不显示 quick-add / source handle 的既有语义保持不变
- 统一节点面板
  - inspector 仍能正确切换 `设置 / 运行时 / AI`
  - `startNode` 与普通节点都能挂载到同一入口组件
- runtime 模板
  - `startNode` 无上游摘要，但保留试运行与结果区
  - 普通节点保留“直接输入，不补齐真实上游 context”的诚实提示
  - 最近一次 node run input/output 仍正确展示
- 节点特性区
  - `startNode` 继续展示 trigger 输入字段编辑器
  - 普通节点继续展示 `WorkflowNodeConfigForm`

前端基线验证至少运行：

- `corepack pnpm --dir web lint`
- `corepack pnpm --dir web exec tsc --noEmit --incremental false`
- 命中的 targeted vitest

## 11. 风险与控制

- 风险：为了“统一模板”把节点特性硬塞回一个大组件。
  - 控制：统一壳层与节点差异定义分离，节点特性只通过 slot 注入。

- 风险：`startNode` 迁移时破坏现有 payload cache / modal 流程。
  - 控制：先迁 runtime 骨架，再保留原有 startNode 行为函数，避免一次性重写。

- 风险：contract 区在 `startNode` 与普通节点之间继续保持不同位置。
  - 控制：统一由 settings/runtime 模板 definition 决定 section 位置，不再让组件私自分叉。

- 风险：结构节点首轮虽然共用模板，但展示文案还不够精确。
  - 控制：先保证同一壳层和一致信息结构，后续逐节点补专属 copy。

## 12. 交付结果

交付后应达到以下状态：

- 所有节点都通过统一的画布卡片壳渲染，而不是把公共动作写死在单组件里。
- inspector 里节点细节有统一入口，`设置` 和 `运行时` 的公共骨架稳定下来。
- `startNode` 不再是“特例中心”，而是第一个完整接入节点基类的样板节点。
- 后续继续细化 `endNode`、`condition/router`、`tool`、`agent` 时，主要改节点特性 slot，而不是继续复制新的大面板。
