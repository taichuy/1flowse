# Workspace Starter Template Persistence

## 背景

上一轮提交 `feat: add workflow source governance model` 已经把 starter / node / tool 的来源语义收成共享 `workflow source model`，但 `workspace templates` 仍停留在前端 `planned` 占位，没有真实数据源和治理入口。

这会带来两个直接问题：

1. 创建页虽然已经能表达 `builtin / workspace / ecosystem` 三类来源 lane，但 workspace lane 还不能承载真实业务。
2. editor 里已经积累的 workflow 草稿，无法沉淀成团队可复用的 starter，导致“应用新建编排”主线仍缺少 workspace 级复用闭环。

结合 `runtime-foundation` 的 P0 顺序，这一轮优先把 workspace starter 从“来源模型”推进到“真实存储、读取和最小治理入口”。

## 目标

本轮只做最小但真实可用的闭环：

1. 后端持久化 workspace starter 模板。
2. 创建页读取真实 workspace starter 数据，而不是继续把 lane 停留在 `planned`。
3. editor 提供最小治理入口，允许把当前 workflow 保存为 workspace starter。
4. 不引入第二套 DSL，workspace starter 继续以已校验的 `workflow definition` 作为事实内容。

本轮不做：

- 模板归档 / 删除 UI
- workspace 多租户隔离
- 模板审批流
- plugin-backed node source 的统一后端 contract

## 实现

### 1. 后端新增 workspace starter 模型与迁移

新增：

- `api/app/models/workspace_starter.py`
- `api/migrations/versions/20260311_0004_workspace_starter_templates.py`

落库对象：

- `workspace_starter_templates`

当前字段覆盖：

- `workspace_id`
- `name`
- `description`
- `business_track`
- `default_workflow_name`
- `workflow_focus`
- `recommended_next_step`
- `tags`
- `definition`
- `created_from_workflow_id`
- `created_from_workflow_version`

这里刻意没有引入“模板专属 DSL”，而是直接保存经过后端校验的 `workflow definition` 快照，保持 `7Flows IR` 优先。

### 2. 新增 workspace starter API

新增：

- `GET /api/workspace-starters`
- `POST /api/workspace-starters`
- `PUT /api/workspace-starters/{template_id}`

相关文件：

- `api/app/api/routes/workspace_starters.py`
- `api/app/schemas/workspace_starter.py`
- `api/app/services/workspace_starter_templates.py`

当前能力边界：

- `GET`：供创建页读取 workspace starter library
- `POST`：供 editor 把当前 workflow 保存成 workspace starter
- `PUT`：为后续前端治理入口预留更新链路

所有写入仍复用现有 `validate_workflow_definition()`，避免 workspace starter 绕过 workflow 设计态校验。

### 3. 创建页接入真实 workspace starter 数据源

更新：

- `web/app/workflows/new/page.tsx`
- `web/components/workflow-create-wizard.tsx`
- `web/lib/get-workspace-starters.ts`
- `web/lib/workflow-starters.ts`

当前变化：

- 创建页会并行读取 `/api/workspace-starters`
- starter library 会把 builtin starter 与 workspace starter 合并展示
- source lane 中的 workspace lane 不再固定显示 `planned`
- workspace starter 会沿用统一的 `workflow source model` 和业务主线元数据

这意味着“starter library”终于不只是页面文案，而是真正开始承载 workspace 级业务资产。

### 4. editor 提供最小治理入口

更新：

- `web/components/workflow-editor-workbench.tsx`

当前新增：

- `保存为 workspace starter` 按钮
- 自动根据当前 workflow definition 推断业务主线
- 以当前 workflow 定义、名称、版本为基础，生成 workspace starter 元数据并写回后端

这里故意先用“最小治理入口”，而没有把 editor 直接做成复杂模板后台：

- 先验证沉淀链路是否成立
- 再决定后续需要多少模板治理视图和编辑能力

## 影响范围

后端：

- `api/app/main.py`
- `api/app/models/__init__.py`
- `api/app/models/workspace_starter.py`
- `api/app/schemas/workspace_starter.py`
- `api/app/services/workspace_starter_templates.py`
- `api/app/api/routes/workspace_starters.py`
- `api/migrations/versions/20260311_0004_workspace_starter_templates.py`

前端：

- `web/app/workflows/new/page.tsx`
- `web/components/workflow-create-wizard.tsx`
- `web/components/workflow-editor-workbench.tsx`
- `web/components/workflow-starter-browser.tsx`
- `web/lib/get-workspace-starters.ts`
- `web/lib/workflow-starters.ts`

文档：

- `docs/dev/runtime-foundation.md`
- `docs/history/2026-03-11-workspace-starter-template-persistence.md`

## 架构判断

### 1. 是否衔接上一次提交

是，而且是直接衔接。

连续关系是：

1. 上一次提交先把 `source governance model` 收成共享前端语义。
2. 这一轮把 `workspace template` 从 `planned` 推到真实后端存储和读取。

这条链路没有偏离主业务，而是在把“应用新建编排”从视图层概念推进成真实可复用能力。

### 2. 基础框架是否已经足够

当前判断：足够继续推进主业务。

已经连起来的链路：

- starter library
- workflow create
- workflow editor
- workflow version save
- recent run overlay
- workspace starter persistence

因此后续不应再回到“只做底座不做业务入口”的节奏。

### 3. 架构是否解耦

当前比上一轮更进一步，但仍未完全解耦：

- starter / node / tool 已共享来源语义
- workspace starter 已有独立后端模型与 API，没有继续写死在页面常量里
- editor 通过 `/api/workspace-starters` 写入治理入口，而不是把模板保存逻辑塞进 workflow CRUD

仍待继续拆开的部分：

- node catalog / tool registry / starter template 仍未统一到共享后端 contract
- editor 里的模板治理入口还只是最小按钮，不是完整治理工作台

### 4. 长文件风险

本轮之后仍需继续盯住：

1. `api/app/services/runtime.py` 约 1387 行
2. `web/components/workflow-node-config-form.tsx` 约 1136 行
3. `web/components/workflow-editor-workbench.tsx` 约 922 行

其中第三项因为本轮新增了 workspace starter 治理入口，已经更接近下一次需要拆分的阈值，后续应优先抽出：

- workflow 保存 / starter 保存动作
- run overlay 状态获取
- 画布壳层状态

## 验证

已执行：

```powershell
cd web
pnpm exec tsc --noEmit
pnpm lint
```

结果：

- `pnpm exec tsc --noEmit` 通过
- `pnpm lint` 通过

已执行：

```powershell
cd api
py -3 -m compileall app
```

结果：

- Python 源码编译检查通过

未执行：

- 后端运行时集成验证
- 数据库迁移实际升级验证

原因：

- 当前桌面环境没有可直接使用的 `uv` / `python` 命令，只有 `py`
- 本机未安装后端依赖，直接导入 `fastapi` 会失败，无法在当前环境完成完整 API 启动验证

## 下一步

### P0

1. 给 workspace starter 补前端治理视图：至少支持查看、更新和筛选，不让治理入口长期停留在 editor 的单个按钮。
2. 把 starter / node / tool 三条来源链继续推进到统一后端 contract，减少前端对来源 lane 的重复拼装。

### P1

1. 优先拆 `web/components/workflow-editor-workbench.tsx`，把保存动作、画布壳层和 run overlay 状态拆开。
2. 继续结构化 `llm_agent`、`output`、edge `mapping[]` 等高频节点配置。

### P2

1. 继续推进 Dify compat adapter 与受约束 IR 的目录/绑定链路。
2. 再进入 API 调用开放主线，补发布配置与协议映射。
