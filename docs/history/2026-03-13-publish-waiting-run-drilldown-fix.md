# 2026-03-13 Publish Waiting Run Drilldown Fix

## 背景

- 在阅读 `AGENTS.md`、`docs/product-design.md`、`docs/technical-design-supplement.md`、`docs/dev/runtime-foundation.md` 并复核最近一次提交 `a0dc29c feat: add publish run status governance` 后，当前判断是：项目主线仍然应该继续承接 P0 的 `API 调用开放`，尤其是 waiting / async 生命周期治理，而不是回头再造新的发布模型。
- 对当前未提交改动做定向回归时，`tests/test_published_native_async_routes.py` 与 `tests/test_workflow_publish_activity.py` 暴露出同一个问题：publish activity 列表想展示 waiting run 的当前节点和等待原因，但路由错误地把 `waiting_reason` 当成 `Run` 字段读取。
- 这与仓库级约束冲突：waiting lifecycle 的事实来源应继续围绕 `runs / node_runs / run_events` 演进，不能为了前端展示方便，把节点级状态错误平铺到 run 模型上。

## 目标

- 修复 publish activity 在 waiting run 场景下的真实回归。
- 保持当前 `PublishedEndpointInvocationItem` 的响应结构不变。
- 用这次修复验证“发布治理继续承接统一运行事实源”这一架构方向没有偏离。

## 本轮实现

- 更新 `api/app/api/routes/published_endpoint_activity.py`：
  - 引入 `NodeRun` 查询，不再从 `Run` 读取不存在的 `waiting_reason`
  - 保留 `run_current_node_id` 直接来自 `Run.current_node_id`
  - 新增 `waiting_reason_lookup`
  - 先按 `run.current_node_id == node_run.node_id` 命中当前等待节点
  - 若当前节点未命中，再退回同一 run 下 `status=waiting` 的 node run，避免 waiting run 的审计项丢失原因信息
- 保持 `api/app/schemas/workflow_publish.py` 现有输出字段不变，无需改前端消费契约。

## 影响范围

- `api/app/api/routes/published_endpoint_activity.py`
- publish governance 的 invocation item 序列化逻辑
- waiting / async published route 的治理回归测试

## 验证

- 在 `api/` 下执行：`python -m pytest tests/test_published_native_async_routes.py tests/test_workflow_publish_activity.py -q`
- 结果：`5 passed`

## 判断与结论

- 最近一次提交 `a0dc29c` 需要继续衔接，而且衔接方向是正确的：继续补 publish governance 对 waiting run 的可见性。
- 当前基础框架已经写到“可以继续推进主业务”的程度，但推进方式必须是沿统一事实源补全链路，而不是为了面板展示把 node-level 状态错误上提到 run-level。
- 这次修复再次说明：项目当前真正的高优先级不是“再起一套新治理页面”，而是继续把 `streaming / SSE`、waiting lifecycle drilldown 与统一事件流对齐补完整。

## 下一步

1. 优先继续补 `streaming / SSE` 发布链路与统一事件流映射。
2. 在 publish governance 中继续补 waiting / async lifecycle drilldown，直接复用 `run_events / callback tickets / node_runs`。
3. 紧接着回到结构治理：优先拆 `api/app/services/runtime.py`，其次拆 `api/tests/test_runtime_service.py`。
