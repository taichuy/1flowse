# 2026-03-16 Workflow Save Validation Issues

## 背景

- 最近几轮提交已经把 workflow definition preflight、workspace starter create/update/save-as 逐步推进为结构化 validation issues，但主 workflow `create/update` 正式保存链路仍主要返回扁平 `detail` 字符串。
- 这导致 editor 存在一处断层：preflight 能按 `schema / node_support / tool_reference / tool_execution / publish_version` 分类聚合问题，真正点击“保存 workflow”时却又退回字符串错误；创建页 starter -> workflow、server action 的工具绑定更新也仍依赖这种旧返回。
- 本轮同步复核仓库现状后，结论仍然明确：基础框架已经足够支撑继续推进功能完整度，不需要回头重造 runtime / editor / publish 骨架；更高优先级的是继续沿统一 validation / governance 主链补齐一致性。

## 目标

- 让 `POST /api/workflows` 与 `PUT /api/workflows/{id}` 在 definition guard 失败时，也返回与 preflight / workspace starter 一致的 `detail.message + detail.issues[]`。
- 让 workflow editor 保存、创建页从 starter 创建 workflow、以及 workflow tool binding server action 复用同一套错误解析，而不是分别手搓字符串处理。
- 补一份明确的项目现状留痕，说明当前架构已能支撑后续功能开发、扩展性与治理能力推进，但仍有若干长文件热点需要继续拆层。

## 实现

### 后端

- `api/app/api/routes/workflows.py`
  - 新增 workflow definition validation 错误的统一抛出 helper。
  - `create / update / validate-definition` 三条入口现在共享同一套结构化 `detail.message + detail.issues[]` 返回语义。

### 前端

- `web/lib/get-workflows.ts`
  - 新增共享的 workflow validation error 解析 helper。
  - 新增 `createWorkflow()` 与 `updateWorkflow()`，统一消费后端结构化错误体。
- `web/components/workflow-editor-workbench.tsx`
  - 保存 workflow 改为复用 `updateWorkflow()`，不再手写旧的字符串错误解析。
- `web/components/workflow-create-wizard.tsx`
  - 创建 workflow 改为复用 `createWorkflow()`，当 starter definition 不合法时能直接收到后端权威错误信息。
- `web/app/actions/workflow.ts`
  - workflow tool binding 更新链路也接入共享 workflow validation error 解析，避免后端错误结构升级后 server action 又退回泛化报错。

### 测试

- `api/tests/test_workflow_routes.py`
  - 为 create/update 路由的校验错误补统一消息提取 helper。
  - 明确断言 unavailable node 与 preflight 的 `issues[]` 结构，确保本轮不是只改 UI 文案，而是真的把正式保存链路收口到结构化 issue。

## 项目现状判断

### 是否需要衔接最近提交

- 需要，而且这是最自然的衔接。
- 最近提交把 workspace starter validation issues 做成结构化分类；本轮继续把 workflow create/update 正式保存链路接到同一模型上，避免 workflow / starter / preflight 三条主链继续分裂。

### 基础框架是否已写好

- 是，且已经超过“基础脚手架”阶段。
- 后端已经有 workflow version、compiled blueprint、runtime、published surface、run diagnostics、sensitive access、workspace starter governance 等真实事实层；前端也已经有 workflow create、editor、publish、run diagnostics、starter library 等主干入口。
- 当前更像“沿既有 IR + runtime + governance 主链持续补真”，而不是“先补基础框架再谈功能开发”。

### 架构是否支撑后续功能、扩展性、兼容性、可靠性与安全性

- **功能性开发**：支撑。当前 `7Flows IR + workflow definition validation + compiled blueprint + runtime + published gateway + run views` 已形成可持续叠代的主链。
- **插件扩展性 / 兼容性**：基本支撑。compat adapter、tool catalog、workflow library source lane 的分层已经形成，但 compat lifecycle / catalog hydration / source governance 仍需继续拆细。
- **可靠性 / 稳定性**：中等偏好。workflow save / starter save / preflight 的一致性已明显提高；但 `WAITING_CALLBACK`、published callback drilldown、scheduler/治理视图仍是高优先级收口点。
- **安全性**：方向正确但未完全落地。`sandbox_code` 已做 fail-closed，sensitive access 有真实 inbox / diagnostics / bulk governance，但独立 `SandboxBackendRegistration / SandboxExecution` 协议仍未完整交付。

### 哪些代码热点仍值得继续解耦

- `api/app/services/workspace_starter_templates.py`
- `api/app/services/runtime_node_dispatch_support.py`
- `api/app/api/routes/workspace_starters.py`
- `api/app/services/run_views.py`
- `web/components/workflow-editor-workbench.tsx`
- `web/components/workspace-starter-library.tsx`

这些文件当前已经不是“必须立刻重写”的阻塞点，但行数和职责密度都偏高；后续应继续按 facade / helper / section / presenter 方向拆层，避免后续功能叠加时再次回流成新的 god object。

## 影响范围

- `api/app/api/routes/workflows.py`
- `api/tests/test_workflow_routes.py`
- `web/lib/get-workflows.ts`
- `web/components/workflow-editor-workbench.tsx`
- `web/components/workflow-create-wizard.tsx`
- `web/app/actions/workflow.ts`
- `docs/dev/runtime-foundation.md`

## 验证

- `api/.venv/Scripts/uv.exe run pytest tests/test_workflow_routes.py -q`
  - `42 passed`
- `web/pnpm exec tsc --noEmit`
  - 通过

## 结论

- 项目当前基础架构能够继续支撑功能性开发、兼容层扩展和治理能力推进，不需要回头重写底座。
- 当前最值得优先推进的不是“重搭框架”，而是继续沿统一 validation / governance / diagnostics 主链补齐断层，让 workflow、starter、publish、sensitive access、callback 这些主业务入口始终复用同一套事实模型和错误语义。
- 本轮把 workflow create/update 的保存错误正式收口到结构化 issues 后，前端与后端在保存时的认知已经进一步对齐，后续再补 `field/path` 级定位、starter portability、publish binding identity 或 sensitive access policy guard 会更顺。

## 下一步

1. 继续为 workflow / starter validation issue 增加 `field/path` 级定位，减少用户仍需手动排查 JSON 的成本。
2. 继续把同一套 issue 语义扩到 bulk refresh/rebase、publish binding sync 和更多 server action，避免边缘入口重新退回字符串报错。
3. 按 `runtime-foundation` 既定优先级，继续推进 graded execution、sensitive access 闭环、`WAITING_CALLBACK` durable resume 与 run/publish diagnostics 收口。
