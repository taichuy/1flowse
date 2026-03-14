# 2026-03-11 Workflow Editor 拆分与 Agent/Output 结构化配置

## 背景

`web/components/workflow-node-config-form.tsx` 和 `web/components/workflow-editor-workbench.tsx` 已经承担了过多职责：

- `workflow-node-config-form.tsx` 同时负责节点分发、5 类节点表单、授权区块、schema 解析和工具函数。
- `workflow-editor-workbench.tsx` 同时负责 editor 状态编排、保存链路、run overlay、画布节点渲染和大块页面结构。

这会直接拖慢后续“编排节点能力”主线推进，尤其是 `llm_agent` / `output` 结构化配置还未补上时，继续往单文件堆功能会明显增加维护成本。

## 目标

1. 先把 editor 两个核心大组件按职责拆开，降低继续开发时的耦合面。
2. 在拆分基础上，继续补一层真正服务主业务的结构化配置，而不是只做目录调整。
3. 把当前事实同步回运行时开发基线，避免 `runtime-foundation` 继续停留在拆分前状态。

## 决策与实现

### 1. 拆分 `workflow-node-config-form`

保留顶层分发入口：

- `web/components/workflow-node-config-form.tsx`

按职责拆出子模块：

- `web/components/workflow-node-config-form/shared.ts`
- `web/components/workflow-node-config-form/authorized-context-fields.tsx`
- `web/components/workflow-node-config-form/tool-node-config-form.tsx`
- `web/components/workflow-node-config-form/mcp-query-node-config-form.tsx`
- `web/components/workflow-node-config-form/branch-node-config-form.tsx`
- `web/components/workflow-node-config-form/llm-agent-node-config-form.tsx`
- `web/components/workflow-node-config-form/output-node-config-form.tsx`

拆分原则：

- 把共享常量、schema 解析、分支规则工具和 record/array 处理收敛到 `shared.ts`
- 把 MCP / LLM Agent 共用的授权配置 UI 抽成 `authorized-context-fields.tsx`
- 新增 `llm_agent` 与 `output` 的结构化表单入口，继续保留高级 JSON 兜底

### 2. 拆分 `workflow-editor-workbench`

保留顶层状态编排入口：

- `web/components/workflow-editor-workbench.tsx`

拆出页面与辅助模块：

- `web/components/workflow-editor-workbench/shared.ts`
- `web/components/workflow-editor-workbench/run-overlay.ts`
- `web/components/workflow-editor-workbench/workflow-canvas-node.tsx`
- `web/components/workflow-editor-workbench/workflow-editor-hero.tsx`
- `web/components/workflow-editor-workbench/workflow-editor-sidebar.tsx`
- `web/components/workflow-editor-workbench/workflow-editor-canvas.tsx`

拆分原则：

- 顶层文件只保留 editor 状态、保存动作和节点/边更新逻辑
- hero / sidebar / canvas UI 各自独立
- 运行态 overlay 的读取逻辑和画布节点渲染从主文件移出

### 3. 补齐当前高频节点的结构化配置

新增结构化配置覆盖：

- `llm_agent`
  - provider
  - modelId
  - temperature
  - system prompt / task prompt
  - tools / MCP / sandbox 开关
  - 显式可读上下文授权
- `output`
  - format
  - responseKey
  - contentType
  - response notes
  - includeRunMetadata

当前边界：

- 这些字段先作为 editor 设计态事实落到 definition/config 中
- 复杂 schema、runtimePolicy、edge `mapping[]` 仍保留高级 JSON 或后续结构化补齐

## 影响范围

- workflow editor 的继续开发入口从“单文件堆叠”改为“顶层编排 + 子模块演进”
- `llm_agent` / `output` 不再完全依赖高级 JSON，节点能力主线向真实可用又推进了一步
- 后续若继续补 edge mapping、join 策略、节点输入输出 schema，可直接在拆分后的模块上演进

## 验证

在 `web/` 下执行：

```powershell
pnpm exec tsc --noEmit
pnpm lint
```

结果：

- TypeScript 通过
- ESLint 通过

## 当前结果

本轮完成后，关键文件体量变化如下：

- `web/components/workflow-node-config-form.tsx`：降到 29 行，顶层只保留节点分发
- `web/components/workflow-editor-workbench.tsx`：降到 529 行，主文件只保留 editor 状态编排
- `api/app/services/runtime.py`：当前约 1387 行，已低于后端 1500 行偏好阈值，但仍是后续应继续盯住的后端拆分对象

## 下一步

1. 继续补 `edge mapping[]`、`runtimePolicy.join` 和节点输入输出 schema 的结构化编辑，完成“编排节点能力”下一段高频配置闭环。
2. 继续推进 workspace starter 第三阶段治理，把 refresh / rebase / history / batch actions 接进当前 library contract。
3. 评估是否把 `api/app/services/runtime.py` 继续拆成执行规划、节点策略和事件写入子层，避免后端运行时再次回到 God object 轨道。
