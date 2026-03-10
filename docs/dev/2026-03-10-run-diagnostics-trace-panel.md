# Run 诊断页 Trace 面板增强

## 背景

前一轮已经补上了：

- `GET /api/runs/{run_id}/trace`
- 时间范围、`payload_key`、游标和 replay 元信息
- 独立的 run 诊断页

但前端诊断页仍然主要停留在“把 `GET /api/runs/{run_id}` 整包平铺出来”的阶段：

- 事件列表没有过滤能力
- 不能沿 `cursor` 翻页
- `sequence` / `replay_offset_ms` 没有在 UI 中体现
- 导出仍需要手工拼 API URL

这会让 trace API 已经存在，但人类排障效率还没有真正接上。

## 目标

把 run 诊断页推进为最小可用的 trace 工作台：

1. 前端直接消费 `GET /api/runs/{run_id}/trace`
2. 支持按事件类型、节点、时间窗、`payload_key` 过滤
3. 支持基于 opaque `cursor` 的窗口翻页
4. 在页面上直接暴露 trace / events 导出入口
5. 把 replay 相关元信息展示出来，但不把 UI 伪装成 AI 唯一追溯入口

## 实现

### 1. 新增 run trace 前端数据层

新增：

- `web/lib/get-run-trace.ts`

负责：

- 解析 `searchParams`
- 归一化 `limit` / `order`
- 生成 trace 查询字符串
- 读取 `/api/runs/{id}/trace`
- 在 API 报错时把错误消息回传给页面

这样 run 诊断页后续的过滤、翻页和导出都围绕同一套 query 工作。

### 2. run 诊断页改为同时读取 run detail 与 trace

更新：

- `web/app/runs/[runId]/page.tsx`

当前页面会并行读取：

- `getRunDetail(runId)`
- `getRunTrace(runId, traceQuery)`

取舍是：

- `run detail` 继续承担人类摘要层
- `run trace` 承担可过滤的事件检索层

也就是说，这页不是把 trace API 替换掉，而是把 trace API 接成真正可用的诊断入口。

### 3. 诊断面板补过滤、翻页和导出

更新：

- `web/components/run-diagnostics-panel.tsx`

主要增强：

- 新增 trace 过滤表单：
  - `event_type`
  - `node_run_id`
  - `payload_key`
  - `created_after`
  - `created_before`
  - `order`
  - `limit`
- 新增当前过滤条件摘要
- 新增 trace summary 区，展示：
  - total / matched / returned event count
  - trace / matched 时间边界
  - returned duration
  - first / last event id
  - available payload keys
- 新增基于 `prev_cursor` / `next_cursor` 的窗口翻页
- 新增导出入口：
  - 原始 `/events`
  - 当前过滤后的 `/trace`
- 事件列表改为展示：
  - `sequence`
  - `replay_offset_ms`
  - `payload`

### 4. 保持“人类诊断层”和“机器追溯层”的边界

这轮没有把 UI 做成新的事实层：

- AI / 自动化 仍应优先读取 `/api/runs/{id}/trace`
- 前端只是把已有机器接口组织为更高效的人类排障入口
- 时间范围输入当前明确要求传 UTC ISO，避免浏览器本地时间语义和后端默认 UTC 解释混淆

## 影响范围

- `web/app/runs/[runId]/page.tsx`
- `web/components/run-diagnostics-panel.tsx`
- `web/lib/get-run-trace.ts`
- `web/lib/runtime-presenters.ts`
- `web/app/globals.css`

## 验证

执行：

```powershell
cd web
pnpm lint
```

结果：

- lint 通过，无 ESLint 错误

## 当前边界

这轮仍然没有实现：

- trace 的专用导出格式选择，例如 JSONL / 回放包
- 浏览器内无刷新的 trace 交互和局部刷新
- 基于前端图形时间线的 replay 回放
- `GET /api/runs/{run_id}` 去掉大体量 `events` 的接口瘦身

## 下一步

更连续的后续顺序是：

1. 评估是否为 trace 增加显式导出格式，而不是只打开原始 JSON。
2. 在不破坏边界的前提下，把 replay 信息继续组织成更直观的时间线视图。
3. 回到后端评估 `get_run` 是否需要支持“摘要模式”，避免 run detail 与 trace 重复搬运事件数据。
