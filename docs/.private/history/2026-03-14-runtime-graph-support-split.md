# 2026-03-14 runtime graph support split

## 背景

- 用户本轮要求先阅读协作约定、用户偏好、产品设计、技术补充与运行时现状，再判断项目是否需要衔接上一次提交、基础框架是否写好、结构是否解耦，以及哪些长文件应优先继续拆分。
- 上一次提交 `6f9fbb2` 已把 `run load / resume / callback` 从 `runtime.py` 拆到 `runtime_run_support.py`，并在 `docs/dev/runtime-foundation.md` 中明确把 `runtime_graph_support.py` 作为下一步 P0 热点。
- 当前项目判断仍是：基础框架已具备“可编排、可调试、可发布、可追溯”的后端骨架，但还没有进入“只剩人工逐项界面设计”的阶段，因此应继续推进主业务完整度，而不是提前停在 UI 润色。

## 现状判断

### 1. 是否需要衔接上一次提交

- 需要直接衔接。
- 上一次提交已经把 runtime 主文件降到 481 行，但同时把 `runtime_graph_support.py` 暴露成新的显著热点；如果这一轮不继续接着拆，runtime 结构治理会停在半截。

### 2. 基础框架是否已经设计写好

- 核心基础框架已经具备继续开发的条件，不是空壳。
- 当前代码事实已经覆盖：workflow version / compiled blueprint、运行时事件事实层、waiting / resume、callback ticket、artifact store、published surface、run diagnostics 入口与工作台主骨架。
- 但 loop、完整 callback bus、节点配置完整度和部分治理 UI 仍在补齐中，因此还不能判断为“框架完善到只剩界设”。

### 3. 架构之间是否解耦分离

- 整体方向是解耦的，而且最近两轮都在朝正确边界收口。
- publish governance 已拆层；runtime 也已具备 run / lifecycle / node execution / graph support 的基本分层。
- 当前主要问题不再是“整体耦死”，而是个别支撑文件仍聚合了过多辅助逻辑，需要继续顺着既有分层拆薄。

### 4. 哪些文件仍然偏长

- 这轮开发前最明显的热点包括：
  - `api/app/services/runtime_graph_support.py`
  - `api/app/services/runtime_node_execution_support.py`
  - `web/components/run-diagnostics-panel.tsx`
- 其中 `runtime_graph_support.py` 与上一轮的 runtime 主文件拆分构成连续治理链，因此优先级最高。

## 本轮目标

- 顺着上一次提交继续治理 runtime P0 热点。
- 把 `runtime_graph_support.py` 从“branch + selector + mapping + join + context access 全堆一起”的状态继续拆层。
- 保持 runtime 行为、join 语义、edge mapping 语义与事件事实层不变。

## 实现

### 1. 新增 `runtime_branch_support` mixin

- 新增 `api/app/services/runtime_branch_support.py`。
- 把 branch / selector / edge expression 相关逻辑独立出来，包括：
  - `_should_activate_edge`
  - `_select_branch_from_rules`
  - `_select_branch_from_expression`
  - `_resolve_selector_path`
  - `_edge_expression_matches`
  - branch key / selector helper
- 这样 selector 与 branch expression 不再和 mapping / join 混在同一文件里。

### 2. 新增 `runtime_mapping_support` mixin

- 新增 `api/app/services/runtime_mapping_support.py`。
- 把 field mapping / merge 相关逻辑独立出来，包括：
  - `_accumulated_input_for_node`
  - `_overlay_mapped_input`
  - `_apply_edge_mappings`
  - `_resolve_mapping_source_value`
  - `_transform_mapping_value`
  - `_merge_mapping_target_value`
- 这让 edge mapping 的输入叠加、transform 和 mergeStrategy 演进有了独立落点。

### 3. 收口 `runtime_graph_support` 为组合层

- `api/app/services/runtime_graph_support.py` 现在改为组合 `RuntimeBranchSupportMixin` 与 `RuntimeMappingSupportMixin`，主文件只保留：
  - authorized context / MCP query
  - retry policy
  - join policy / join decision
  - join / context read 事件载荷构造
- 主文件行数由原先的热点体量降到 `292` 行，不再承载所有图辅助职责。

## 影响范围

- `api/app/services/runtime_branch_support.py`
- `api/app/services/runtime_mapping_support.py`
- `api/app/services/runtime_graph_support.py`
- `docs/dev/runtime-foundation.md`

## 验证

- `./api/.venv/Scripts/uv.exe run --directory api ruff check app/services/runtime_graph_support.py app/services/runtime_branch_support.py app/services/runtime_mapping_support.py app/services/runtime.py`
- `./api/.venv/Scripts/uv.exe run --directory api pytest tests/test_runtime_service.py tests/test_run_routes.py -q`
- 结果：`37 passed`

## 结论

- 这一轮是对上一次提交的直接衔接，不需要改道去做新的横向功能。
- 当前基础框架足够继续推进产品设计目标，且结构边界继续朝“执行主链、节点执行、图辅助、发布治理、诊断入口”分层收口。
- 项目仍未进入“需要人工逐项进行界面设计”的阶段，因此未触发通知脚本。

## 下一步规划

1. **P0：继续治理 `api/app/services/runtime.py` 与 `api/app/services/runtime_node_execution_support.py`**
   - 把 `_continue_execution` 与节点执行 support 继续按 node lifecycle / waiting transition / output finalization 收口。
2. **P1：继续治理 `web/components/run-diagnostics-panel.tsx`**
   - 保持“聚合摘要优先”的产品边界，继续拆 summary / section / drilldown。
3. **P1：继续补节点配置完整度**
   - 让 provider / model / tool / publish 配置继续向结构化配置段演进。
