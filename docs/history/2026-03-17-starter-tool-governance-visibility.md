# 2026-03-17 starter tool governance visibility

## 背景

- `docs/dev/runtime-foundation.md` 的 `P0 sandbox / protocol` 已明确：在 plugin catalog、editor、publish detail 之外，下一步优先把同一份 tool governance 摘要补到 workflow library / starter authoring 等剩余作者入口。
- 继续复核后发现，新建向导虽然已经能让作者快速选择 starter，但在真正创建前仍看不到 starter 已引用 tool 的治理约束：
  - 无法提前判断 starter 是否已经引用了 `L2 / L3` 高风险工具；
  - 无法在创建前知道这些工具是否默认要求 `sandbox / microvm`；
  - 如果 starter 引用了当前目录里不存在的 tool，也要等进入编辑器后才逐步暴露。

## 目标

1. 把 starter 模板与 workflow library snapshot 中的 tool catalog 接上同一份治理事实。
2. 让作者在创建 workflow 前就能看到 starter 已引用 tool 的默认执行边界，而不是把这层认知推迟到进入编辑器之后。
3. 保持前端只复用现有 catalog 事实与共享 presenter，不新增第二套治理模型或额外 API。

## 实现

### 1. starter template 解析引用工具

- `web/lib/workflow-starters.ts` 现在会从 starter definition 中统一提取：
  - `tool` 节点上的 `config.tool.toolId` / `config.toolId`
  - `llm_agent.toolPolicy.allowedToolIds`
- 解析结果会回查 workflow library snapshot 里的 `tools`，生成：
  - `referencedTools`
  - `missingToolIds`
  - `governedToolCount`
  - `strongIsolationToolCount`
- 引用工具会按 `compareToolsByGovernance` 排序，优先把高风险、强隔离的 tool 放到前面。

### 2. 新建向导主卡接入治理摘要

- `web/components/workflow-create-wizard.tsx` 现在会在选中 starter 的摘要卡中额外显示：
  - `Governed tools`
  - `Strong isolation`
  - 前两个已引用工具的共享 `ToolGovernanceSummary`
- 若 starter 引用了当前 catalog 中不存在的工具，会直接在当前页给出错误提示，而不是等进入编辑器后再逐步发现。

### 3. starter 浏览卡片补齐治理信号

- `web/components/workflow-starter-browser.tsx` 的每张 starter 卡片现在会直接展示：
  - `governed tools`
  - `strong isolation`
- 作者在切换 track 或浏览 starter 列表时，不需要点进详情就能先做高风险 starter 的初步筛选。

## 影响评估

### 架构链条

- **扩展性增强**：starter authoring 直接复用现有 `tool-governance` presenter，后续补到 workflow library 其他入口时可继续沿同一套摘要层扩展。
- **兼容性增强**：全程复用 `workflow library` 快照里的 `tools` 事实，不新增 API，也不让 starter 模板长出第二套 tool contract。
- **可靠性 / 稳定性增强**：作者创建 workflow 前就能看见 starter 引用工具的隔离要求，减少创建后再回头排查“为什么这个 starter 一进编辑器就被强隔离约束卡住”。
- **安全性增强**：高敏 tool 的默认执行边界从 catalog / editor / publish detail 继续前移到 starter 选择阶段，进一步降低高风险能力被无感带入新 workflow 的概率。

### 对产品闭环的帮助

- 这轮属于 **人使用层 + 人与 AI 协作层 + AI 治理层** 的继续补闭环，不是局部样式打磨。
- **人使用**：workflow 作者在创建前就能判断 starter 的治理成本和隔离要求。
- **人与 AI 协作**：starter 若预置了 `llm_agent.allowedToolIds` 或 tool node 绑定，作者现在能在进入编辑器前先理解其工具边界。
- **AI 治理**：`sensitivity -> default execution -> supported execution classes` 的事实继续前移到更早的 authoring 环节，避免治理只存在于运行时或保存失败时。

## 验证

- `web/pnpm exec tsc --noEmit`
- `web/pnpm lint`
  - 结果：通过（仅有 Next.js 关于 `next lint` 弃用提示）

## 下一步

1. 继续把同一份治理摘要补到 workflow library 其他作者入口，例如 workspace starter 保存后的管理视图和 workflow library browser。
2. 回到 `P0 sandbox / protocol` 主线，继续推进 compat / native tool 在 profile / dependency governance 上的真实隔离兑现，避免展示已充分但 backend capability 仍停在 execution class 一层。
3. 若后续 starter 开始大量预置 `llm_agent.toolPolicy` 与 `mockPlan.toolCalls`，可继续把“starter 引用工具 -> validation focus / 跳转编辑器位置”串成一条更完整的 authoring 导航链。
