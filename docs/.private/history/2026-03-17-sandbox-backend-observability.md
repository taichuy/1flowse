# 2026-03-17 sandbox backend observability

## 背景

- 2026-03-17 上一轮已经把 compat `tool/plugin` 的显式 `sandbox / microvm` 请求绑定到统一 `sandbox backend` 选择主链，并把 readiness guard 前移到 workflow / workspace starter 保存前。
- 但运行事实层仍有一个明显缺口：backend 绑定信息虽然已经进入 tool execution trace payload，`/api/runs/{run_id}/execution-view` 与前端 run diagnostics 还不能直观看到“这次高风险执行到底落到了哪个 sandbox backend”。
- 这会削弱 operator 对“协议已经绑定但 adapter 侧是否兑现”“为什么这次是 compat adapter 在跑、同时又绑定了 sandbox backend”的排障能力，不利于当前用户重点关注的 sandbox isolation / protocol 链路场景。

## 目标

- 把 compat / tool execution trace 中已有的 `sandbox_backend_id / sandbox_backend_executor_ref` 真正汇总到 run execution view。
- 让前端 diagnostics 可以直接展示 sandbox backend 绑定，而不是只看到 `executor_ref`。
- 在不改写 runtime 主链的前提下，增强 sandbox / protocol 场景的可观测性和 operator 排障效率。

## 本轮实现

### 1. tool execution 事件补齐 sandbox backend 字段

- 更新 `api/app/services/tool_execution_events.py`
- `tool.execution.dispatched / blocked / fallback` 的基础 payload 现在会在存在绑定时追加：
  - `sandbox_backend_id`
  - `sandbox_backend_executor_ref`

### 2. run execution view 汇总 sandbox backend 绑定

- 更新 `api/app/services/run_execution_views.py`
- 更新 `api/app/schemas/run_views.py`
- node 级 execution signal snapshot 现会继续收集 sandbox backend 绑定信息，并在 run execution summary 中新增：
  - `execution_sandbox_backend_counts`
- node 详情中新增：
  - `execution_sandbox_backend_id`
  - `execution_sandbox_backend_executor_ref`

### 3. run diagnostics UI 展示 sandbox backend

- 更新 `web/lib/get-run-views.ts`
- 更新 `web/components/run-diagnostics-execution/execution-node-card.tsx`
- 更新 `web/components/run-diagnostics-execution/execution-overview.tsx`
- 当前 execution overview 已能直接看到本次 run 命中过哪些 sandbox backend；node card 也能同时显示：
  - `executor`
  - `sandbox backend`
  - `backend executor ref`

## 影响评估

### 架构链条

- **扩展性增强**：后续继续接更多 sandbox backend / protocol variant 时，不需要再为每条链补独立诊断面。
- **兼容性增强**：把“compat adapter 执行器”与“sandbox backend 绑定”同时暴露，避免两类运行时对象在 operator 视角里继续混成一层。
- **可靠性 / 稳定性增强**：当 adapter 声明支持强隔离但实际排障失败时，当前事实层能更快判断问题落在 host selection、backend readiness 还是 adapter 兑现。
- **安全性增强**：高风险路径不再只是“配置里写了 sandbox / microvm”；operator 可以直接验证 run 事实里是否真的绑定到了 sandbox backend。

### 对产品闭环的帮助

- 这轮推进的是 **AI 与人协作层 + AI 治理层** 的主业务闭环，不是细枝末节 UI 打磨。
- **AI 使用 / 人与 AI 协作**：AI 节点发起高风险 tool call 后，人类 operator 可以在 run diagnostics 里看到真实 backend 绑定，判断隔离承诺是否兑现。
- **AI 治理层**：当 compat adapter、自建 sandbox backend 与 host policy 同时参与执行时，治理与排障入口更贴近统一事实源，而不是依赖推测。

## 验证

- 后端定向测试：`cd api; ./.venv/Scripts/uv.exe run pytest -q tests/test_run_routes.py tests/test_plugin_runtime.py`
  - 结果：`39 passed`
- 后端全量测试：`cd api; ./.venv/Scripts/uv.exe run pytest -q`
  - 结果：`324 passed in 46.71s`
- 前端类型检查：`cd web; pnpm exec tsc --noEmit`
  - 结果：通过
- 前端 lint：`cd web; pnpm lint`
  - 结果：通过

## 仍未完成的缺口

- 当前补的是 **host -> trace -> run diagnostics** 的可观测链；compat adapter 侧如何真正兑现 `sandboxBackend` 绑定，仍需要继续落实到 adapter / runner 协议实现。
- native tool 仍然没有统一进入 sensitivity-driven sandbox backend contract；高风险 native path 仍是下一阶段缺口。
- sandbox backend 当前仍主要展示“选中了谁”，还没有把 backend capability / health drift 的解释收口到 run detail 或 system diagnostics drilldown。

## 下一步

1. 继续把 compat adapter 对 `sandboxBackend` 的协议兑现补成真实隔离执行，而不是只停留在 host 侧选择与诊断可见。
2. 把 native tool 的高风险分级与 fail-closed 语义补到同一条 sandbox backend contract。
3. 继续补 sandbox backend capability / health 的 operator drilldown，减少“知道绑定到了谁，但仍要跳多处页面排障”的断层。
