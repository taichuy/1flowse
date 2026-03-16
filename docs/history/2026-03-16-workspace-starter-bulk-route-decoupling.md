# 2026-03-16 Workspace Starter Bulk Route Decoupling

## 背景

- 最近几轮开发已经持续把 workflow editor、publish panel 和 runtime/publish helper 从单体文件拆成更清晰的 orchestration shell + helper/service 结构。
- `api/app/api/routes/workspace_starters.py` 仍把批量归档、恢复、删除、refresh、rebase 的完整治理分支堆在路由层，既拉高文件长度，也让后续继续补 starter portability、publish binding identity 或更多 bulk governance 时更容易回到“路由层 God function”。
- 本轮复核结论仍然成立：项目主骨架已经足够承接持续功能开发，当前更需要沿既有主线治理热点，而不是回头重搭框架。

## 目标

- 把 workspace starter bulk action 的业务分支从 FastAPI route 下沉到服务层。
- 保持 `/api/workspace-starters/bulk` 的响应契约、skip reason、history 记录和排序行为完全不变。
- 为后续继续扩 bulk governance 与 starter 相关 guard 预留更稳定的 service 边界。

## 实现

### 新增服务层

- 新增 `api/app/services/workspace_starter_bulk_actions.py`
  - 提供 `execute_workspace_starter_bulk_action()` 统一承接 bulk action 主流程。
  - 用 `WorkspaceStarterBulkActionAccumulator` 汇总 `updated_items / deleted_items / skipped_items`。
  - 将 `archive / restore / delete / refresh / rebase` 拆成独立 helper。
  - 保留 `skipped_reason_summary` 的 reason 排序，避免影响现有前端与测试断言。

### 路由层收口

- `api/app/api/routes/workspace_starters.py`
  - `/bulk` 路由现在只负责 HTTP 入参与调用 `execute_workspace_starter_bulk_action()`。
  - 删除路由层重复的 skip summary helper 与大段业务分支。

## 影响范围

- `api/app/api/routes/workspace_starters.py`
- `api/app/services/workspace_starter_bulk_actions.py`
- `docs/dev/runtime-foundation.md`

## 项目现状判断

### 是否需要衔接最近提交？

- 需要，而且是同一条“持续拆热点、避免单体回流”的自然衔接。
- 最近一次提交刚把 workflow editor publish endpoint section 从主卡片中拆开；本轮则把 workspace starter bulk governance 从 route 层拆到 service 层，方向一致。

### 基础框架是否已经写好？

- 是。当前问题已不是“有没有框架”，而是继续维持 runtime / editor / governance 这些主链条的模块边界，不让新增能力再把复杂度堆回单文件。

### 架构是否支持后续功能性开发与扩展？

- 支持。此次改动没有引入第二套 DSL 或执行链，只是把 bulk 治理逻辑从 transport 层挪到 service 层，更符合现有后端分层方向。
- 对后续插件扩展性、兼容性、稳定性和治理闭环来说，这种拆法也更利于继续补 starter 相关校验与批量治理动作。

### 是否还有需要继续解耦的热点？

- 有，`api/app/services/workspace_starter_templates.py` 仍偏长，后续若继续追加 source diff / refresh / rebase 细节，适合继续拆 presenter/helper。
- `web/components/workflow-editor-workbench/use-workflow-editor-graph.ts` 仍是前端下一轮更明确的热点。

## 验证

- `api/.venv/Scripts/uv.exe run pytest tests/test_workspace_starter_routes.py -q`
  - `21 passed`
- `api/.venv/Scripts/uv.exe run python -m compileall app`
  - 通过

## 结论

- 本轮属于低风险、直接服务后续开发的结构治理。
- `workspace_starters` 路由层已明显收口，后续继续推进 starter governance 时不必再在 route 中扩张分支。

## 下一步

1. 继续沿 `runtime-foundation` 既定优先级推进 `starter portability / publish binding identity` 相关 guard。
2. 继续拆解 `api/app/services/workspace_starter_templates.py` 中的 source diff 与 refresh/rebase 细节，避免新热点从 route 转移成 service 单体。
3. 继续治理 `web/components/workflow-editor-workbench/use-workflow-editor-graph.ts`，把 editor graph orchestration 再细分成更稳定的 workflow-level helper。
