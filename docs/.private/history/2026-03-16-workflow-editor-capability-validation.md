# 2026-03-16 Workflow Editor Capability Validation

## 背景

- `7900dd3 feat: surface planned workflow node support status` 已把 `loop`、`sandbox_code` 等节点的 `support_status / support_summary` 接入 workflow library catalog，并让 editor hero / sidebar 能真实提示 planned / unknown 节点。
- 但上一轮改动仍停留在“看得见边界”的阶段：如果 workflow definition 里已经包含 planned / unknown node type，编辑器仍允许继续保存 workflow 或沉淀为 workspace starter。
- 这会让“节点类型已定义”和“当前可执行能力”再次混在一起：用户虽然能看到提示，但仍可能把未进入执行主链的定义继续保存，后续再在 runtime / publish 阶段踩中诚实性问题。

## 目标

- 把最近一轮的 node support status 继续推进到 editor 保存链路，而不是只停留在展示提示。
- 在不伪装 `loop` / `sandbox_code` 已可运行的前提下，阻断包含 planned / unknown node type 的 workflow 持久化动作。
- 让 workflow 保存与 workspace starter 沉淀共享同一套 capability validation 语义。

## 实现

### 1. 前端增加 unsupported node 汇总文案 helper

- 在 `web/lib/workflow-node-catalog.ts` 中新增 `formatUnsupportedWorkflowNodes()`。
- 该 helper 复用现有 `summarizeUnsupportedWorkflowNodes()` 的结构化结果，把 `label / count / supportStatus` 格式化成可直接用于 editor 提示的摘要文本。

### 2. 把 capability validation 接到保存入口

- 在 `web/components/workflow-editor-workbench.tsx` 中基于当前 `graph.currentDefinition.nodes` 计算 `persistBlockedMessage`。
- 当 workflow 中包含 `supportStatus !== available` 的节点类型时：
  - 阻断 `handleSave()`；
  - 阻断 `handleSaveAsWorkspaceStarter()`；
  - 统一通过 editor feedback 区输出错误提示，明确说明当前 workflow 不能继续保存或沉淀为 starter。

### 3. Hero 面板补充当前保存策略说明

- 在 `web/components/workflow-editor-workbench/workflow-editor-hero.tsx` 中增加保存策略提示。
- 当 workflow 中存在 planned / unknown 节点时，hero 直接说明“含 planned / unknown 节点时阻断保存与 starter 沉淀”，避免用户只能通过点击失败后才理解当前边界。

## 影响范围

- 编辑器现在不仅会提示 unsupported node，还会在保存阶段真正执行最小 capability validation。
- `workflow -> workspace starter` 的沉淀入口与 workflow 持久化入口保持同一条诚实性边界，不会再把未进入执行主链的定义继续包装成可复用模板。
- 这轮改动仍保持“前端先诚实表达、runtime 不提前伪装完成”的节奏，没有把 planned 节点偷偷塞回 palette 或执行器。

## 验证

- `cd web; pnpm lint`
- `cd web; pnpm exec tsc --noEmit`

## 结论与下一步

- 这轮把 node support status 从“可见性提示”推进到“保存前能力校验”，是对最近一次提交的直接衔接，也让 workflow editor 更符合当前 MVP 诚实性要求。
- 下一步优先顺序：
  1. 把同一套 capability validation 继续下沉到保存前更细粒度的 node contract / binding 校验，而不是只按 `support_status` 阻断。
  2. 评估是否需要在后端 workflow mutation 链路补最小 server-side capability guard，避免未来出现绕过前端的保存入口。
  3. 继续推进 `loop` 与真实 `sandbox / microvm` adapter 的 runtime 主链落地，让 planned 节点尽快从 catalog 占位走向真实执行能力。
