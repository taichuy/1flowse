# 2026-03-14 Runtime Node Support Split

## 背景

- 最近三轮已先后把 `runtime.py` 中的 run orchestration、graph support、execution progress 收口到独立 support，但 `api/app/services/runtime_node_execution_support.py` 仍集中承载节点准备、节点类型分发、工具调用、凭据解析、重试循环与下游激活等多类职责。
- `docs/dev/runtime-foundation.md` 已将该文件列为当前 P0 热点，说明最近一次提交 `d6aeda2 refactor: split runtime execution progress support` 之后，仍需要继续沿既定方向衔接，而不是停在 `runtime.py` 主文件瘦身阶段。

## 目标

- 继续降低 `runtime_node_execution_support.py` 的职责密度，让节点执行链条按“准备 / 分发 / 重试与传播”三层收口。
- 保持现有运行时行为、事件语义和测试结果不变。
- 让后续热点更聚焦到前端诊断面板与节点配置完整度，而不是继续被同一个 runtime support 文件阻塞。

## 实现

- 新增 `api/app/services/runtime_node_preparation_support.py`，承接：
  - `_prepare_node_run_for_execution()`
  - `_build_node_input()`
  - `_build_skipped_node_run()`
  - `_build_blocked_node_run()`
- 新增 `api/app/services/runtime_node_dispatch_support.py`，承接：
  - `_execute_node()`
  - `_execute_tool_node()`
  - tool binding / input / credential 解析
  - branch / router 节点分发
- `api/app/services/runtime_node_execution_support.py` 收口为更明确的“重试循环 + 失败输出/最终输出/下游激活”职责层。
- `api/app/services/runtime.py` 通过新增 mixin 组合这三层 support，`RuntimeService` 主文件继续只保留执行主链 orchestration。

## 影响范围

- `api/app/services/runtime.py`
- `api/app/services/runtime_node_execution_support.py`
- `api/app/services/runtime_node_preparation_support.py`
- `api/app/services/runtime_node_dispatch_support.py`
- `docs/dev/runtime-foundation.md`

## 验证

- 语法校验：`api/.venv/Scripts/python.exe -m py_compile api/app/services/runtime.py api/app/services/runtime_node_execution_support.py api/app/services/runtime_node_preparation_support.py api/app/services/runtime_node_dispatch_support.py`
- 测试：`api/.venv/Scripts/python.exe -m pytest api/tests/test_runtime_service.py api/tests/test_runtime_service_agent_runtime.py`
- 结果：25 个测试全部通过。

## 当前判断

- 最近一次 git 提交 `d6aeda2 refactor: split runtime execution progress support` 已被本轮有效衔接；runtime 拆分方向继续沿着“主链 orchestration 收口、support 分层承接”的路径推进，没有出现职责重新回流 `runtime.py` 或单一 support 文件的情况。
- 基础框架已经足够支撑继续推进主业务完整度：后端运行时、发布治理、追溯事实层和前端工作台骨架都在，但距离“只剩人工逐项界面设计 / 人工全链路验收”仍有明显差距。
- 当前更明显的结构热点已经从 `runtime_node_execution_support.py` 转向 `web/components/run-diagnostics-panel.tsx` 和节点配置完整度，而不是运行时主链本身。

## 下一步

1. 优先继续治理 `web/components/run-diagnostics-panel.tsx`，把摘要、筛选、详情钻取边界拆得更清楚。
2. 继续补节点配置完整度，把 provider / model / tool / publish 配置进一步结构化。
3. 持续收紧 publish governance 聚合边界，避免查询与统计回流单文件。
