# Workflow Editor / Infinite Canvas 架构参考

## 当前仓库事实

- 画布基础设施已经使用 `@xyflow/react`
- editor 相关逻辑主要分布在 `web/components/workflow-editor-workbench/`
- 右侧 inspector 位于 `web/components/workflow-editor-inspector.tsx`
- 节点配置表单位于 `web/components/workflow-node-config-form/`
- 当前状态仍以局部 Hook 为主，不是 `zustand`

## 推荐职责拆分

### 1. Plane / Render

`@xyflow/react` 只负责：

- 无限平面
- 节点与边渲染
- 视口控制
- 选择、拖拽、连接基础交互

不要把业务推导、节点治理规则和 schema 映射塞进 plane 层。

### 2. Layout

只有当下列任一条件成立时，再引入 `elkjs`：

- 需要一键自动排版
- 节点类型变多，手工摆放已经影响作者效率
- 分支 / Join / Router 结构已经需要稳定布局语义

引入后也应集中到 `layout adapter`，而不是在各个组件里各自算位置。

### 3. Store / History

只有当这些状态明显跨多个壳层交织时，再引入 `zustand + zundo`：

- graph nodes / edges
- selection
- viewport
- sidebar / inspector open state
- undo / redo history
- staged draft vs persisted draft

如果当前只是在单个容器与几个 Hook 之间流转，继续保持 Hook 拆分即可，不必过早上 store。

### 4. IR Adapter

前端编辑器只能把后端 workflow 事实映射为 view model：

- node label / type / capability group
- schema / runtime / publish status
- diagnostics / governance badges
- run overlay

不能在前端编辑器里再发明第二套 workflow DSL。

## Dify 可借鉴但不能照搬的点

可以借：

- 无限画布的职责拆分
- 自动排版独立出去
- 编辑器状态与历史独立出去
- 节点规则通过 registry / schema 收敛

不能照搬：

- 命名
- 目录结构
- store 约定
- 假设仓库已经有配套 service hooks / DSL / 面板脚手架

## 交互建议

- 左侧：node library / template / quick add
- 中间：canvas plane
- 右侧：inspector / publish / diagnostics / assistant
- 次级详情：modal / drawer / popover

不要把所有治理、说明、状态摘要都压成和画布并列的一串卡片。

## 节点与面板的推荐边界

- node shell：只放节点摘要、状态、快速操作
- node config：放右侧 inspector 或 modal，不要塞回 node 内部
- run overlay：作为运行态投影，不污染持久化 config
- diagnostics / publish：作为工作台二级 tab 或 drawer，不要把所有信息平铺在首页

## 引入新依赖时的建议

- `elkjs`：只在自动布局需求已明确时引入
- `zustand`：只在 editor 状态已经跨多个组件难以维护时引入
- `zundo`：只在需要稳定 undo / redo snapshot 时引入

每次引入都要回答：

1. 解决了当前哪一个真实痛点
2. 作用域是否只限 editor
3. 是否保持 7Flows IR 为唯一事实源
