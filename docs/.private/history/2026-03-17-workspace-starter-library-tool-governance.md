# 2026-03-17 workspace starter library tool governance visibility

## 背景

- `docs/dev/runtime-foundation.md` 的 `P0 sandbox / protocol` 已明确：在首页 plugin catalog、workflow editor、publish detail、新建向导之后，下一步应继续把同一份工具治理事实补到剩余作者入口，避免作者只能在创建前看见 starter 引用 tool 的隔离要求，却在进入 workspace starter 管理页后又丢失这层认知。
- 用户本轮额外强调：后续推进要优先看“用户层、人与 AI 协作层、AI 治理层”的全局闭环，而不是陷入单一场景的局部修补；解耦判断也要同时兼顾职责、体量、扩展性，以及对人和 AI 的检索追踪友好度。

## 目标

1. 把 starter definition 里的工具治理推导抽成共享层，不让创建页和 starter 管理页各自维护一套解析逻辑。
2. 在 `workspace starter library` 的列表和详情中直接展示引用工具的治理摘要、强隔离要求和 catalog 缺口。
3. 保持复用现有 plugin catalog 事实与 `ToolGovernanceSummary` 展示层，不新增额外 API，也不引入第二套治理模型。

## 实现

### 1. 抽共享 helper，统一 definition -> tool governance 推导

- 新增 `web/lib/workflow-definition-tool-governance.ts`：
  - 从 workflow definition 统一提取 `tool` 节点绑定的 `toolId`；
  - 同时提取 `llm_agent.toolPolicy.allowedToolIds`；
  - 回查当前 plugin tool catalog，生成：
    - `referencedToolIds`
    - `referencedTools`
    - `missingToolIds`
    - `governedToolCount`
    - `strongIsolationToolCount`
- `web/lib/workflow-starters.ts` 改为复用该 helper，避免创建页和其他 starter authoring 入口出现重复的工具引用解析逻辑。

### 2. workspace starter 页面接入真实工具目录

- `web/app/workspace-starters/page.tsx` 现在会并行拉取：
  - `getWorkspaceStarterTemplatesWithFilters()`
  - `getPluginRegistrySnapshot()`
- `WorkspaceStarterLibrary` 因此可以在不新增 API 的情况下，直接使用当前 workspace 可见的 tool catalog 来解释 starter definition 的治理状态。

### 3. workspace starter library 补齐治理可见性

- `web/components/workspace-starter-library/use-workspace-starter-library-state.ts`：
  - 为每个模板预计算共享的 tool governance snapshot；
  - 同时汇总 `governedTemplateCount`、`strongIsolationTemplateCount`、`missingToolTemplateCount`，供 hero 和列表复用。
- `web/components/workspace-starter-library/hero-section.tsx`：
  - 顶部摘要从“只有模板数量”扩展到“治理覆盖率”，新增 governed / strong isolation / missing tool 三类信号。
- `web/components/workspace-starter-library/template-list-panel.tsx`：
  - 每张 starter 卡片现在直接展示：
    - `governed tools`
    - `strong isolation`
    - 缺失 catalog tool 的 warning chip 与简要提示
- `web/components/workspace-starter-library/definition-snapshot-panel.tsx`：
  - 详情区新增 `Referenced tools` section；
  - 直接复用 `ToolGovernanceSummary` 展示每个已引用 tool 的治理摘要；
  - 如果 starter 还引用了当前 workspace 看不到的 tool，会用独立 `Catalog gap` 卡片显式列出。

## 影响评估

### 架构链条

- **扩展性增强**：starter definition 的 tool governance 解析被抽成共享 helper，后续继续补到 workflow library 其他入口时不需要再复制解析逻辑。
- **兼容性增强**：全程复用现有 plugin catalog 事实与 `ToolGovernanceSummary` 展示层，不新增额外 API，也不让 workspace starter 长出第二套 tool contract。
- **可靠性 / 稳定性增强**：作者在管理已有 starter 时也能立即看见高风险工具和缺失 catalog tool，减少“创建前知道、保存后忘记”的治理断层。
- **安全性增强**：高敏 / 强隔离工具的默认执行边界继续前移到 workspace starter 管理面，降低高风险能力在模板长期复用中被无感传播的概率。

### 对产品闭环的帮助

- 这轮属于 **用户层 + 人与 AI 协作层 + AI 治理层** 的同步补强，不是纯样式优化。
- **用户层**：模板维护者在 starter library 里就能判断某个模板是否带入了高风险 tool，以及当前 workspace 是否缺少对应 catalog 项。
- **人与 AI 协作层**：带 `llm_agent.allowedToolIds` 的 starter 不再只在创建向导阶段可见；进入管理页后，团队仍能追踪 AI 会接触到哪些工具。
- **AI 治理层**：`sensitivity -> default execution -> strong isolation -> catalog gap` 的链路继续向作者/维护者入口前移，而不是只在运行时报 blocked 或进入编辑器后才被动发现。

## 验证

- `web/pnpm exec tsc --noEmit`
- `web/pnpm lint`
  - 结果：通过（仅有 Next.js 关于 `next lint` 弃用提示）

## 下一步

1. 继续把同一份治理摘要补到 workflow library 的其他作者入口，尤其是 editor/library 的剩余管理视图。
2. 回到 `P0 sandbox / protocol` 主线，继续推进 compat / native tool 在 profile / dependency governance 上的真实隔离兑现，避免展示已充分但 backend capability 仍停在 execution class 一层。
3. 若 starter 后续进一步沉淀为跨团队模板资产，可继续把“治理摘要 -> validation focus -> 一键回到编辑器定位”串成闭环，而不只是停留在查看层。
