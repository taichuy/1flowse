# 2026-03-16 Workspace starter template service refactor

## 背景

- `docs/dev/runtime-foundation.md` 已把“热点重新向少数 service 聚拢”列为当前会拖慢后续闭环推进的主要风险之一。
- 在 2026-03-16 这轮优先级复核里，`api/app/services/workspace_starter_templates.py` 被持续标记为 workspace starter 主热点，承担了模板 CRUD、definition validation、source diff、refresh/rebase 与 history 多类职责。
- 这条链路已经进入用户层闭环：workspace starter 既服务 workflow 新建体验，也连接后续 source governance、starter portability 与模板治理；如果继续把新规则叠加在单个 service 中，会抬高后续业务推进成本。

## 目标

1. 按 `runtime-foundation` 的优先级，先消解 `workspace_starter_templates.py` 的职责混杂问题。
2. 保持对外 API 与行为不变，不回头重搭 workspace starter 主链。
3. 为后续继续补 source governance、starter portability 校验和工作流定义治理预留稳定 helper 边界。

## 实现

### 1. 拆出 definition validation helper

- 新增 `api/app/services/workspace_starter_template_validation.py`。
- 将以下公共逻辑从主 service 中抽离：
  - template tag 规范化；
  - starter definition 的 persistable validation；
  - publish version allowed set 计算。
- `create_template`、`update_template`、`refresh_from_workflow` 与 `rebase_from_workflow` 现在统一复用同一套 helper，不再各自内联 workflow tool/adapters/publish version 组装逻辑。

### 2. 拆出 source diff helper

- 新增 `api/app/services/workspace_starter_template_diff.py`。
- 将 source diff、node/edge label、changed fields 递归比较与 summary 汇总逻辑从主 service 中抽离。
- `WorkspaceStarterTemplateService.build_source_diff()` 现在只保留 façade 角色，便于后续继续补 diff 规则时保持 service 主链稳定。

### 3. 收口主 service 为编排层

- `api/app/services/workspace_starter_templates.py` 从原先主热点进一步收口为模板主流程 orchestration：
  - 查询与序列化；
  - refresh/rebase 主分支；
  - history 落库；
  - create/update 入口调用。
- 这次拆分没有引入新的 runtime 语义，也没有改变 route/service 边界，属于低风险热点治理，而不是架构回摆。

## 影响范围

- workspace starter 相关规则更容易继续扩展，不必每次都改动主 service 大文件。
- 对“用户层”有直接帮助：starter 创建、更新、refresh/rebase 这条路径后续更容易持续补齐治理与 portability 细节。
- 对“AI 与人协作层”有间接帮助：模板与工作流定义治理更稳定，有利于后续把 source diff / validation 结果继续暴露成更一致的排障与提示语义。

## 验证

- `cd api && .\.venv\Scripts\uv.exe run pytest -q tests/test_workspace_starter_routes.py tests/test_workflow_library_routes.py`
  - 结果：`23 passed in 10.10s`
- `cd api && .\.venv\Scripts\uv.exe run pytest -q`
  - 结果：`304 passed in 34.65s`
- `git diff --check`
  - 结果：通过（仅提示 Git 的行尾转换警告，无 diff 格式错误）

## 下一步

1. 优先继续治理 `runtime_node_dispatch_support.py` 与 `agent_runtime.py`，它们仍是 runtime 主链上最明确的后端热点。
2. 在 workspace starter 侧继续补 source governance / portability 校验时，优先沿新 helper 扩展，不把规则重新堆回主 service。
3. 继续把 editor / publish / waiting 主链上的提示语义与治理规则保持同一套 façade + helper 演进方式，避免复杂度回流。
