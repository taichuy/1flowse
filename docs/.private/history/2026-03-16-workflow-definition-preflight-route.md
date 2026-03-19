# 2026-03-16 Workflow Definition Preflight Route

## 背景

- workflow editor 近几轮已经补上 planned node、contract schema、tool catalog reference、tool execution capability、publish version reference 等本地 preflight。
- 但真正持久化时仍以后端 `validate_persistable_workflow_definition()` 为准，前后端需要各自维护一套近似规则，存在继续漂移的风险。
- 随着后续还会继续补 sensitive access policy、publish binding identity、starter portability 等 guard，单靠前端镜像规则会越来越脆弱。

## 目标

- 在 workflow 保存前提供一个后端权威的 preflight 入口。
- 让 editor 可以在真正 `PUT /api/workflows/{id}` 之前，先复用与持久化一致的校验上下文。
- 避免在 workflows route 内继续复制 create/update 的验证拼装逻辑。

## 实现

- 在 `api/app/api/routes/workflows.py` 中抽出 `_validate_workflow_definition_for_persistence()`，统一封装：
  - tool catalog reference index
  - workspace-visible adapter list
  - publish version allowed set
  - `validate_persistable_workflow_definition()`
- 新增 `POST /api/workflows/{workflow_id}/validate-definition`：
  - 对已存在 workflow 返回规范化后的 `definition`
  - 同时返回本次保存对应的 `next_version`
  - 失败时仍沿用现有 `422 detail` 语义，保持 editor 与 API 口径一致
- 在 `web/lib/get-workflows.ts` 新增 `validateWorkflowDefinition()` helper。
- 在 `web/components/workflow-editor-workbench.tsx` 的 `handleSave()` 中，改为：
  1. 先跑本地 blockers
  2. 再调用后端 preflight
  3. 最后用 preflight 返回的规范化 definition 执行真正保存

## 影响范围

- `api/app/api/routes/workflows.py`
- `api/app/schemas/workflow.py`
- `api/tests/test_workflow_routes.py`
- `web/lib/get-workflows.ts`
- `web/components/workflow-editor-workbench.tsx`
- `docs/dev/runtime-foundation.md`

## 验证

- 新增 API 测试覆盖：
  - valid definition 的 preflight 成功并返回 `next_version`
  - invalid publish version reference 的 preflight 返回 `422`
- 计划执行：
  - `api/.venv/Scripts/uv.exe run pytest api/tests/test_workflow_routes.py -q`
  - `cd web; pnpm exec tsc --noEmit`

## 结论

- 当前基础框架已经足以继续做功能性开发，但 editor/save 链路需要逐步收敛到“前端体验层 + 后端权威规则层”的模式，才能支撑后续插件扩展、兼容性演进与稳定性要求。
- 这次 preflight route 不是新功能外露，而是给后续 workflow editor 完整度推进补一个更稳的架构支点。

## 下一步

1. 把同一套后端 preflight 继续复用到 `workspace starter` create/update 的前端入口。
2. 在 preflight 返回体中细分 issue categories，替代当前前端只能展示聚合错误文本的方式。
3. 在 workflow editor 中继续补 sensitive access policy 与更明确的 structured form / advanced JSON 边界。
