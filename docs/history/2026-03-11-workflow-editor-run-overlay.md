# Workflow Editor Run Overlay

## 背景

2026-03-11 之前，workflow editor 已经完成一轮“节点配置结构化”推进：

- `tool` / `mcp_query` / `condition` / `router` 开始脱离纯 JSON 编辑
- inspector 与 editor 主壳层已做初步拆分

但 editor 仍缺一条关键闭环：运行态事实虽然已经通过 `runs` / `node_runs` / `run_events` 和 `/api/runs/{run_id}`、`/trace` 暴露出来，却还没有回接到 workflow 画布本身。用户如果要排障，仍然需要先离开编辑器进入 run diagnostics 页面，画布节点本身无法直接承接“哪一步跑了、哪一步失败了、最近 trace 在发生什么”。

结合 `docs/dev/runtime-foundation.md` 的上一轮优先级，这一轮最自然的衔接项就是继续推进 P0 第一项：把运行态状态接回 editor。

## 目标

- 为 workflow editor 提供 workflow 级 recent runs 入口，而不是继续依赖首页聚合视图拼装上下文
- 把选中 run 的 `node_runs` 状态映射回画布节点高亮
- 在 editor 内提供最近一次 run 的节点时间线和 trace 预览
- 保持“人类诊断层”和“机器追溯层”边界清晰：
  - editor 内展示摘要、时间线和入口
  - 详细过滤、导出和完整 trace 仍复用现有 `/runs/{run_id}`、`/trace` 与 run diagnostics 页面

## 实现方式

### 1. 新增 workflow 级 recent runs API

新增：

- `GET /api/workflows/{workflow_id}/runs?limit=8`

返回内容面向 editor 侧“最近执行上下文选择”场景，包含：

- run 基本状态与版本
- 创建/执行时间
- `node_run_count`
- `event_count`
- `last_event_at`
- `error_message`

实现上复用 `runs` 主表，并通过聚合 `node_runs` / `run_events` 生成摘要，不为 editor 再造一套运行态事实模型。

### 2. Editor page 并行拉取 recent runs

`/workflows/[workflowId]` 页面在原有 workflow detail、workflow list、plugin registry 之外，增加 recent runs 的并行读取。

这样 editor 首屏就能知道：

- 当前 workflow 最近是否执行过
- 默认应附着哪一个 run 做画布 overlay

### 3. 画布节点叠加运行态

在 `WorkflowCanvasNodeData` 上追加非持久化运行态字段：

- `runStatus`
- `runNodeId`
- `runDurationMs`
- `runErrorMessage`
- `runLastEventType`
- `runEventCount`

这些字段只用于 editor 渲染，不回写 workflow definition，也不进入版本快照。

映射来源：

- `RunDetail.node_runs`
- `RunTrace.events`

当前策略：

- 通过 `node_id -> node_run` 直接把节点执行状态挂回画布
- 通过 `node_run_id -> trace events` 汇总最近事件类型与数量
- 在节点壳层用颜色、状态 badge、耗时和最近事件做最小可读反馈

### 4. 独立 run overlay panel

新增 `workflow-run-overlay-panel.tsx`，避免继续把运行态展示逻辑堆回 editor 主组件。

panel 负责：

- 选择 recent run
- 手动刷新 recent runs
- 展示当前 run 摘要
- 展示选中节点对应的 node run 摘要
- 展示 node timeline
- 展示 trace preview
- 提供 “打开 run diagnostics” 与 “导出 trace JSON” 入口

这样 editor 主组件只负责：

- 选中 run 的加载
- overlay 数据映射
- 把渲染交给专门的 panel

## 影响范围

- 后端：
  - `api/app/api/routes/workflows.py`
  - `api/app/schemas/run.py`
- 前端：
  - `web/app/workflows/[workflowId]/page.tsx`
  - `web/components/workflow-editor-workbench.tsx`
  - `web/components/workflow-run-overlay-panel.tsx`
  - `web/lib/get-workflow-runs.ts`
  - `web/lib/workflow-editor.ts`
  - `web/app/globals.css`

## 验证

### 前端

已执行：

```powershell
cd web
pnpm build
```

结果：

- Next.js production build 通过
- TypeScript 类型检查通过

### 后端

当前环境没有可直接调用的 `uv` 命令，因此未执行 `uv run ruff` / `uv run pytest`。

已执行：

```powershell
cd api
py -3 -m compileall app
```

结果：

- 新增/修改的 Python 文件通过编译检查

## 当前边界

- editor 内已经能选择 recent run、看到节点状态高亮和时间线，但还没有做到“画布内逐事件回放”
- trace 预览当前只展示最近窗口摘要，完整过滤、分页和导出仍然跳转到 run diagnostics
- recent runs 目前是手动刷新，不是 SSE / WebSocket 实时附着
- 一个节点在同一 run 中默认按单个 `node_run` 映射；Loop 等未来多次执行场景还需要更细粒度策略

## 下一步

1. 把 trace filter、cursor 翻页和更细的 replay 控件继续收进 editor，而不是只提供 link-out。
2. 继续把 edge `mapping[]`、join merge strategy 等高频 JSON 区域结构化。
3. 为 workflow editor 补最小测试基线，优先覆盖 recent runs / overlay 映射和结构化配置纯逻辑。
