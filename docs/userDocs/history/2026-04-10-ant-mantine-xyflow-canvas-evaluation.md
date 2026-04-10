# 2026-04-10 Ant Design / Mantine / xyflow 画布与壳层评估

## 背景

- 用户担心 `Ant Design` 更偏企业后台，适合画布外控制台，但在画布内节点、连线、状态高频微调场景里，样式覆盖和交互定制会变重。
- 用户提出候选方向：`Mantine` 作为主组件库，画布 UI 继续自定义。

## 源码结论

- `Ant Design` 当前仍明显偏“企业后台主组件库”。仓库自述就是 `enterprise-class UI design language`，并且 `Table`、`Form`、`Tree`、`Cascader`、`DatePicker` 等复杂控制台组件能力完整，适合后台壳层、列表、表单和配置面板。
- `Ant Design` 的样式能力比旧印象更强，现有组件已支持语义化 `classNames/styles`，也能通过 `ConfigProvider + token` 做局部扩展；但其定制路径仍是 `token + cssinjs + prefixCls + semantic override` 组合，理解成本高于纯 `CSS Modules` 路线。
- `Mantine` 的样式体系确实更贴近编辑器微调诉求。官方文档明确写明全部组件基于 `CSS Modules`，并推荐项目内也优先使用 `CSS Modules`；其 `Styles API` 直接围绕 `className/classNames/styles/CSS variables/data-*` 组织。
- `xyflow` 决定了一个关键事实：画布内节点本身主要不是“跟着主组件库走”，而是业务自定义节点 DOM。`NodeWrapper` 负责拖拽、选中、focus、wrapper class/style；节点内容是业务组件自己渲染。因此真正该重点控制的是“节点/连线/工具条自己的 CSS 与状态边界”，不是先换主组件库。

## 建议

- 推荐 P1 采用混合边界，而不是现在就整体从 `Ant Design` 切到 `Mantine`。
- 推荐边界：
  - 画布外：继续使用 `Ant Design` 搭控制台壳层、表单、表格、抽屉、弹窗、筛选和权限配置页。
  - 画布内：使用 `xyflow + 自定义节点/边/toolbar`，样式统一走 `CSS Modules + CSS Variables`，不要在节点内部堆 `Ant Design` 重组件。
  - 可复用轻交互：若确有必要，只少量引入主组件库的轻量能力到画布浮层，不把节点卡片本身建立在主组件库 DOM 之上。

## 风险判断

- 现在直接切到 `Mantine` 的收益：样式路径更统一，编辑器感更容易做出来。
- 现在直接切到 `Mantine` 的代价：后台复杂组件能力会下降，需要自行补更多表格/筛选/表单组合层，也会推翻此前已沉淀的前端基线决策。
- 因此本次评估只形成建议，不直接改写既有“P1 主组件库为 `Ant Design`”的历史决策；待用户确认后，再更新正式决策文档。
