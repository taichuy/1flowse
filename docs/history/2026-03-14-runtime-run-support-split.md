# 2026-03-14 Runtime Run Support Split

## 背景

- 按 `AGENTS.md` 指定顺序复核了 `docs/product-design.md`、`docs/technical-design-supplement.md`、`docs/dev/runtime-foundation.md` 与 `docs/dev/user-preferences.md`。
- 最近一次 Git 提交是 `8e897ecec924ab0605a82376ba925f2ed302280a`（2026-03-14 19:32:30 +08:00），主题为 `refactor: split published invocation audit aggregation`，核心是把 publish governance 里的 facet / timeline 聚合从 `published_invocation_audit.py` 拆出。
- 该提交完成后，`docs/dev/runtime-foundation.md` 已明确把下一步 P0 指向 `api/app/services/runtime.py` 与 `api/app/services/runtime_graph_support.py`，说明这一轮应继续沿 runtime 结构治理衔接，而不是回到 publish audit 单文件。

## 复核结论

### 1. 上一次提交是否需要衔接

- 需要衔接。
- 上一次提交已经把 publish governance 的热点显著降温，本轮继续推进 runtime 主链拆分，符合上一轮留下的 P0，不是偏离主线的新分支。

### 2. 基础框架是否已经写好

- 已经写到“可持续推进主业务完整度”的阶段，不是空骨架。
- 当前代码事实仍支持这个判断：后端已有 workflow version、compiled blueprint、runtime runs、callback/resume、published surface、trace/export、artifact/tool/ai call 事实层；前端也已有工作台、workflow editor、run diagnostics 等入口。
- 但还没有到“只剩人工逐项界面设计 / 全链路人工验收”的阶段，因此本轮不触发通知脚本。

### 3. 架构之间是否解耦分离

- 整体方向可解耦，且最近两轮都在朝正确方向收口。
- publish governance 已拆出 aggregation / timeline helper；runtime 也已具备 graph / node execution / lifecycle 分层，本轮再把 run load / resume / callback orchestration 从 `runtime.py` 抽出，边界比之前更清晰。
- 剩余主要风险不再是“完全耦死”，而是 runtime 主执行链和 graph support 仍偏重，需要继续拆细职责。

### 4. 是否还有文件过长、需要继续拆分

- 需要，当前最明显的仍是：
  - `api/app/services/runtime_graph_support.py`
  - `web/components/run-diagnostics-panel.tsx`
  - `api/app/services/runtime_node_execution_support.py`
- 本轮完成后，`api/app/services/runtime.py` 已从 818 行下降到 481 行，不再是 runtime 治理中的最大后端热点。

### 5. 主业务是否还能继续推进产品目标

- 可以继续推进，而且当前更适合围绕 runtime、节点配置与诊断体验继续补齐产品完整度。
- 当前平台已经具备“可编排、可调试、可发布、可追溯”的基础事实层，接下来应继续把剩余热点拆薄，并把节点配置和诊断 UI 做成能承接产品设计的一等能力，而不是把精力过早切到纯视觉润色。

## 本轮目标

- 衔接上一轮 runtime 治理优先级，减少 `api/app/services/runtime.py` 对 run load / resume / callback 细节的承载。
- 保持运行时行为、事件事实层与 callback/resume 语义不变。
- 通过最贴近的 runtime / route 测试验证拆分没有破坏已有闭环。

## 实现

### 1. 新增 `runtime_run_support` mixin

- 新增 `api/app/services/runtime_run_support.py`。
- 将以下职责从 `RuntimeService` 主文件中抽离：
  - `resume_run`
  - `_resolve_run_blueprint_record`
  - `receive_callback`
  - `load_run`
  - `list_workflow_runs`
- 新 mixin 继续复用既有 `_continue_execution`、`_callback_tickets`、`_tool_gateway`、`_context_service` 和 `_artifact_store`，没有引入第二套 runtime 状态机。

### 2. 让 callback / resume orchestration 在新文件内继续拆层

- 没有把 `receive_callback` 原样整体搬运，而是在新 mixin 中补充了若干局部 helper：
  - `_load_run_artifacts_or_raise`
  - `_build_callback_handle_result`
  - `_resolve_tool_call_record`
  - `_apply_callback_result_to_node_run`
  - `_persist_callback_received_events`
  - `_serialize_timestamp`
- 这样既减轻 `RuntimeService` 主文件体量，也避免新文件再次积累成另一颗 callback God method。

### 3. 收口 `RuntimeService` 主文件职责

- `api/app/services/runtime.py` 现在主要保留：
  - runtime 依赖初始化
  - workflow version / compiled blueprint 入口校验
  - compiled workflow 执行入口
  - runtime 依赖刷新
  - `_continue_execution` 主执行循环
- 这让主文件更接近“执行入口 + 执行主链 orchestration”，而不是同时承载 run 查询、callback ticket 消费和恢复逻辑。

## 影响范围

- `api/app/services/runtime.py`
- `api/app/services/runtime_run_support.py`
- `docs/dev/runtime-foundation.md`

## 验证

- `./api/.venv/Scripts/uv.exe run --directory api ruff check app/services/runtime.py app/services/runtime_run_support.py`
- `./api/.venv/Scripts/uv.exe run --directory api pytest tests/test_runtime_service.py tests/test_run_routes.py -q`
- 结果：`37 passed`

## 结论

- 这一轮明确衔接了上一次提交留下的 runtime P0，不需要回退到 publish audit 继续打转。
- 当前基础框架仍足够继续推进产品完整度目标，且结构拆分已证明后端主链不是“写死不可演进”的状态。
- runtime 的后续主战场已经进一步收敛到：
  - `runtime.py` 里的 `_continue_execution`
  - `runtime_graph_support.py` 的 mapping / selector / join 聚合逻辑
  - 前端 `run-diagnostics-panel.tsx` 的调试摘要与钻取拆层

## 下一步规划

1. **P0：继续治理 `api/app/services/runtime_graph_support.py` 与 `api/app/services/runtime.py` 执行主链**
   - 优先把 selector / mapping / join 相关图辅助逻辑继续拆薄，同时评估 `_continue_execution` 是否继续按 node lifecycle / waiting transition / output finalization 收口。
2. **P1：继续治理 `web/components/run-diagnostics-panel.tsx`**
   - 保持“聚合摘要优先，详细日志按需展开”的产品边界，继续拆 summary / section / drilldown。
3. **P1：继续补节点配置完整度**
   - 让 provider / model / tool / publish 配置继续演进成结构化配置段，减少“大表单拼接”倾向。
