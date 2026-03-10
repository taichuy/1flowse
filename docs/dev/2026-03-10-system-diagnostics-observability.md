# System Diagnostics Observability

## 背景

上一轮已经把 `compat:dify` 的 discovery/sync 闭环接到了 API 和 adapter 服务，
但前端首页仍然只展示基础服务健康，用户和后续 AI 协作者还看不到：

- compat adapter 当前是否在线
- 已同步的工具目录是否真的进入 API 注册表
- 最近运行事件是否已经落库并可用于诊断

同时，用户明确强调“测试结果可见、应用日志可见”应成为 7Flows 的长期偏好。

## 目标

把首页从“基础服务健康页”升级成一块真正的系统诊断入口，先承接三类与当前阶段最相关的信号：

1. compat adapter health
2. tool discovery/sync 结果
3. 最近的 `run_events` 运行日志

## 实现

### 1. 扩展系统诊断 API

`/api/system/overview` 新增：

- `plugin_tools`
- `runtime_activity.recent_runs`
- `runtime_activity.recent_events`

同时新增：

- `GET /api/system/runtime-activity`

这样首页和后续调试面板都可以复用同一套系统诊断视图，而不需要再拼装独立日志接口。

### 2. 首页接入 discovery/sync 诊断

`web/app/page.tsx` 现在除了服务健康卡片，还会展示：

- compat adapter 列表与健康状态
- 每个 adapter 的“同步工具目录”动作
- API 当前已注册的 compat 工具目录
- 最近 runs 与最近 run events

其中同步动作通过 Next Server Action 调用：

- `POST /api/plugins/adapters/{adapter_id}/sync-tools`

### 3. run events 作为日志主干

前端没有另起一套应用日志源，而是直接把最近 `run_events` 作为当前系统诊断里的日志主干。
这符合仓库既有边界：调试、流式输出、回放优先复用统一事件流。

### 4. 日志粒度策略

本轮补充了一条明确策略：

- 系统诊断默认展示聚合统计、事件类型分布和 payload 预览
- 不在 overview 里直接返回大段完整事件 payload
- 详细日志继续保留给 `run` 详情或后续专门调试视图

这样既保留了用户可见的监控信号，也避免首页诊断被低层细节淹没。

### 5. 首页与 run 诊断职责拆分

继续推进时，用户明确要求不要再把“详细日志查看”继续堆到首页。

因此本轮把职责进一步拆开：

- 首页保留系统诊断摘要、最近 runs 与事件类型分布
- 详细日志查看迁移到单独的 run 诊断面板
- run 诊断面板直接复用 `GET /api/runs/{run_id}`，承载节点输入输出、错误信息与完整事件流

这样既保持首页是“总览入口”，也让 run 级排障开始具备独立的一等位置。

## 影响范围

- `api/app/schemas/system.py`
- `api/app/api/routes/system.py`
- `api/tests/test_system_routes.py`
- `web/app/page.tsx`
- `web/app/runs/[runId]/page.tsx`
- `web/components/run-diagnostics-panel.tsx`
- `web/app/actions.ts`
- `web/components/adapter-sync-form.tsx`
- `web/lib/get-run-detail.ts`
- `web/lib/get-system-overview.ts`
- `web/lib/api-base-url.ts`
- `web/app/globals.css`
- `docs/dev/user-preferences.md`

## 验证

本轮计划验证：

- `api/tests/test_system_routes.py`
- `api/tests/test_plugin_routes.py`
- `api/tests/test_plugin_runtime.py`
- `pnpm build`

如环境允许，也建议补做一次：

- `pnpm lint`

## 下一步建议

更自然的后续顺序是：

1. 把 sync 结果推进到持久化存储与重启恢复
2. 继续扩展首页或独立调试面板，对接更多运行态信号
3. 为“测试结果可见”补一条更系统的验证结果展示链路
