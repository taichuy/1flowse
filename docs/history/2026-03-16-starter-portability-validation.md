# 2026-03-16 Workspace starter portability validation

## 背景

- `docs/dev/runtime-foundation.md` 已把 `starter portability` 列为 workflow editor / workspace starter 主链的持续优先项。
- 当前 `workflow create wizard` 会直接复用 workspace starter 的 `definition`；如果 starter 快照中保留 `publish.workflowVersion` 固定版本号，派生出的新 workflow 会继承源 workflow 的发布版本钉死值。
- 这种定义虽然对“源 workflow 自身”是合法的，但对“starter 作为可复用模板”并不可靠：新 workflow 的首个保存版本、后续 bump 节奏与模板来源 workflow 不必一致。

## 目标

1. 把 `starter portability` 从文档待办推进成真实持久化 guard。
2. 阻止把带固定 `publish.workflowVersion` 的 definition 沉淀为 workspace starter。
3. 继续复用现有 `message + issues[] + path/field` 验证面，不另起第二套模板校验协议。

## 实现

### 后端

- 新增 `api/app/services/workspace_starter_portability_validation.py`
  - 聚焦 workspace starter 专属 portability 规则。
  - 当前首条规则：`publish.{index}.workflowVersion` 只要显式固定版本，即判定为非便携模板定义。
- `api/app/services/workspace_starter_template_validation.py`
  - 在复用 `validate_persistable_workflow_definition()` 完成通用 workflow 持久化校验后，再叠加 workspace starter portability 校验。
  - portability 失败时，继续抛出 `WorkflowDefinitionValidationError`，返回结构化 `starter_portability` issue。

### 前端

- `web/components/workflow-editor-workbench/use-workflow-editor-validation.ts`
  - 补齐 `starter_portability` 的类别标签，确保 editor/save-as 与 starter library 吃到后端 issue 后能给出清晰摘要。

### 测试

- `api/tests/test_workspace_starter_routes.py`
  - 新增 starter create 场景：拒绝保存带固定 `publish.workflowVersion` 的 starter。
  - 新增 starter update 场景：拒绝把已有 starter 更新成固定发布版本的非便携模板。

## 影响范围

- `api/app/services/workspace_starter_portability_validation.py`
- `api/app/services/workspace_starter_template_validation.py`
- `api/tests/test_workspace_starter_routes.py`
- `web/components/workflow-editor-workbench/use-workflow-editor-validation.ts`
- `docs/dev/runtime-foundation.md`

## 评估结论

### 1. 架构是否满足后续开发、扩展、兼容、可靠性与安全性

- 当前满足继续功能开发，不需要回头重搭主骨架。
- `7Flows IR + runtime + publish + diagnostics + starter governance` 主链已经能持续叠加 guard，而不是靠一次性页面逻辑兜底。
- 这次补丁说明：workspace starter 这种“用户层模板能力”也能沿统一 validation surface 演进，兼容性与可靠性不需要靠分叉模型处理。
- 安全与治理方向仍正确，但 `sensitive access policy`、独立 sandbox backend contract、callback waiting operator 动作面还没完全补齐。

### 2. 对业务闭环推进有什么帮助

- 对用户层：避免团队把“只能复用源 workflow 版本号语义”的模板误当成可复用 starter 保存下来。
- 对 AI 与人协作层：starter save / update 失败时继续保留结构化 issue，可直接落回既有 navigator / summary / governance 文案主链。
- 对 AI 治理层：把“模板可迁移性”正式变成持久化 guard，而不是依赖人工记忆或文档约束。

### 3. 与最近提交的衔接关系

- 最近一轮提交仍在继续补 sensitive access / operator 主线；本轮没有偏离该方向，而是沿 `runtime-foundation` 既定优先级补齐 editor / starter 主链中的下一个治理缺口。
- 两条线并不冲突：waiting / governance 主线继续做运行态闭环，starter portability 负责模板沉淀时的正确性与后续可复用性。

### 4. 长文件是否还需要继续解耦

- 需要，且判断没有变化。
- 当前仍值得优先盯住的热点包括：`api/app/services/runtime_node_dispatch_support.py`、`api/app/services/agent_runtime.py`、`web/lib/get-workflow-publish.ts`、`web/lib/workflow-tool-execution-validation.ts`、`web/components/workflow-editor-variable-form.tsx`。
- 本轮新增 portability helper 继续遵守“专用规则进 helper，不回堆主 service”的拆层方向。

## 验证

- 待本轮代码验证统一记录到最终收尾结果。

## 下一步

1. 继续按 `runtime-foundation` 优先级补 `publish binding identity` guard，让 starter / workflow save 的发布治理语义继续对齐。
2. 把 `sensitive access policy` 继续推进到 editor/save 主链，避免治理规则只停留在运行态。
3. 继续拆 `runtime_node_dispatch_support.py` 与 `agent_runtime.py`，防止新增 waiting / policy / tool 调度逻辑重新回流成 service 热点。
