# 2026-03-13 Workspace Starter Library 解耦

## 背景

- 结合 `docs/product-design.md`、`docs/technical-design-supplement.md`、`docs/dev/runtime-foundation.md` 与最近一次提交 `a0dc29c` 的现状判断，当前项目的运行时基础框架已经进入“可持续承接主业务”的阶段，但仍有少数前后端长文件持续承压。
- `web/components/workspace-starter-library.tsx` 在本轮开始前约 1042 行，承载了筛选、表单编辑、source workflow 拉取、history/source diff、refresh/rebase 与批量治理等多类职责。
- 该文件虽然未越过前端 2000 行偏好上限，但已经成为前端真实业务代码中最明显的单点耦合源，也被 `docs/dev/runtime-foundation.md` 标记为需要继续控制体量的目标。

## 目标

- 在不改变业务行为和页面结构的前提下，先把最稳定、最容易复用的一层状态编排抽离出去。
- 为后续继续扩展 starter governance（特别是 source-derived 治理、批量结果钻取和创建主线承接）保留明确边界。
- 用一次小步重构验证“先收口耦合点，再继续补业务”的节奏仍然适用于当前前端代码。

## 本轮实现

- 新增 `web/components/workspace-starter-library/shared.ts`：
  - 收口 `TrackFilter`、`ArchiveFilter`、`WorkspaceStarterFormState`、消息 tone 类型
  - 收口 `buildFormState`、`buildUpdatePayload`、`formatTimestamp`、`buildBulkActionMessage`
- 新增 `web/components/workspace-starter-library/use-workspace-starter-source.ts`：
  - 统一管理 source workflow 拉取
  - 统一管理 history/source diff 的 loading 与 reload
  - 统一管理 refresh / rebase 的副作用和消息回写
  - 暴露 `clearSelectionArtifacts` / `clearSourceDiff`，让 bulk action 不再直接操作零散 setter
- 收敛 `web/components/workspace-starter-library.tsx`：
  - 主组件保留筛选、选中态、编辑表单、批量治理与页面结构编排
  - 不再直接承载 source/history/diff 的副作用细节与重复 helper
  - 行数从约 1042 行下降到约 795 行，明显降低单文件压力

## 影响范围

- `web/components/workspace-starter-library.tsx`
- `web/components/workspace-starter-library/shared.ts`
- `web/components/workspace-starter-library/use-workspace-starter-source.ts`

## 验证

- 在 `web/` 下执行 `./node_modules/.bin/tsc.cmd --noEmit`
- 结果：通过

## 判断与结论

- 最近一次提交 `a0dc29c` 主要补的是 publish run status governance，主线仍是 P0 的 `API 调用开放`；这轮不需要反向继续在 publish 面板上堆功能，而是适合先处理明确的长文件耦合点，避免后续前端治理页再次长回单体。
- 当前基础框架并非“全都写完”，但已经具备继续推进主业务完整度的条件：
  - 后端已有最小 durable runtime、run/node_run/run_event、publish gateway、published activity、scheduler/resume 最小闭环
  - 前端已有创建页、editor、run diagnostics、publish governance、starter governance 等承接面板
  - 当前主要风险不再是“底座完全缺失”，而是少数热点模块继续膨胀后拖慢后续业务推进

## 下一步

1. 继续沿主业务优先推进 P0：补 `streaming / SSE` 发布链路与统一事件流映射。
2. 继续治理长文件热点：优先处理 `api/app/services/runtime.py`，其次是 `api/tests/test_runtime_service.py`。
3. 在 `workspace starter` 主线下继续拆稳定视觉区块：筛选/列表区与详情编辑区可以再考虑拆成 section 组件，但不必提前抽象。
