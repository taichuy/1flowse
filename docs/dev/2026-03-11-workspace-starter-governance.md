# Workspace Starter Governance

## 背景

上一条提交 `feat: persist workspace starter templates` 已经把 workspace starter 做成了真实存储、读取和 editor 保存入口，但治理能力还停留在 editor 里的单个按钮。

这会留下几个明显缺口：

1. 创建页虽然能读到 workspace starter，但团队还没有独立的模板库视图。
2. 模板元数据一旦保存后就缺少查看、筛选、详情和更新入口。
3. `runtime-foundation` 中 P0 明确要求把 workspace starter 从“可保存/可读取”推进到“可治理”，否则主业务链路仍然是不完整的。

## 目标

本轮聚焦一个明确的 P0 衔接点：

1. 给 workspace starter 补独立治理页。
2. 补齐模板列表、业务主线筛选、关键字筛选、详情查看和 metadata 更新。
3. 让 editor、创建页和治理页形成连续往返链路。
4. 顺手抽出 editor 中和 workspace starter 相关的 payload builder，避免主组件继续无边界增长。

本轮不做：

- 模板归档 / 删除
- 来源 workflow diff
- 模板审批流
- 节点库 / starter / 工具目录的统一后端 contract

## 实现

### 1. 后端补齐 workspace starter 查询契约

更新：

- `api/app/api/routes/workspace_starters.py`
- `api/app/services/workspace_starter_templates.py`
- `api/tests/test_workspace_starter_routes.py`

新增能力：

- `GET /api/workspace-starters`
  - 支持 `workspace_id`
  - 支持 `business_track`
  - 支持 `search`
- `GET /api/workspace-starters/{template_id}`
  - 支持读取单个模板详情
- `PUT /api/workspace-starters/{template_id}`
  - 继续承担 metadata 更新

这里仍然坚持 `workflow definition` 作为模板事实内容，没有引入模板专属 DSL。

### 2. 前端新增独立治理页

新增：

- `web/app/workspace-starters/page.tsx`
- `web/components/workspace-starter-library.tsx`

当前治理页支持：

- 模板列表
- 主业务线筛选
- 关键字筛选
- 模板详情查看
- 模板元数据更新
- 从治理页跳回源 workflow

这让 workspace starter 不再只是创建页里的一组卡片，而开始成为真实的团队级模板库入口。

### 3. 创建页、首页和 editor 串上治理入口

更新：

- `web/app/page.tsx`
- `web/components/workflow-create-wizard.tsx`
- `web/components/workflow-editor-workbench.tsx`

当前变化：

- 首页可直接进入 workspace starter 治理页
- 创建页可在选 starter 的同时跳去治理页
- editor 可在保存模板后继续进入治理页查看和维护模板

### 4. 顺手降低 editor 主组件耦合

新增：

- `web/lib/workspace-starter-payload.ts`

变化：

- 把 `workspace starter payload` 构造逻辑从 `workflow-editor-workbench.tsx` 中抽出
- `workflow-editor-workbench.tsx` 从约 919 行降到约 877 行

这次只是小步拆分，但方向是对的：把 starter 治理相关逻辑继续从画布壳层挪走。

## 对当前问题的结论

### 1. 上一次 Git 提交做了什么，是否需要衔接

需要，而且本轮就是直接衔接。

上一次提交主要完成：

- workspace starter 持久化表
- `/api/workspace-starters` 基础读写接口
- 创建页读取 workspace starter
- editor 保存 workspace starter

本轮把这条链路补成：

- 保存
- 列表
- 筛选
- 详情
- 更新

所以这不是换方向，而是在把上一轮的 P0 留白补齐。

### 2. 基础框架是否设计写好了

当前判断：基础框架已经足够支撑主业务继续推进，不需要再回到“只打底座”的节奏。

已经连续的链路包括：

- 新建应用
- starter library
- workflow editor
- workflow version save
- workspace starter governance
- recent run overlay

也就是说，主业务已经有真实落点，后续更应该围绕节点能力、插件兼容和 API 开放继续推进完整度。

### 3. 架构之间是否解耦分离

当前方向是解耦的，但仍未完全拆开。

已经比较清楚的分层：

- `workflow business tracks`
- `workflow source model`
- `workspace starter API`
- `workspace starter governance page`
- `workflow editor`

仍待继续拆开的部分：

- `node catalog / starter template / tool registry` 还没有统一后端 contract
- editor 里的 run overlay、保存链路和画布壳层还混在一起

### 4. 是否存在过长文件需要继续解耦

当前最需要继续盯住的是：

1. `api/app/services/runtime.py` 约 1387 行
2. `web/components/workflow-node-config-form.tsx` 约 1136 行
3. `web/components/workflow-editor-workbench.tsx` 约 877 行

这轮已经先把第 3 项里最稳定的一段抽出来，但真正的拆分工作还没完成。

### 5. 主要功能业务是否可以继续推进项目完整度

可以，而且现在更应该沿主业务推进。

优先级判断：

1. `应用新建编排`
   - workspace starter 治理已补齐一个关键缺口
2. `编排节点能力`
   - 现在最值得继续补结构化节点配置
3. `Dify 插件兼容`
   - 需要把来源 lane 落成真实 contract，再继续 compat adapter 主线
4. `API 调用开放`
   - 仍应放在前面三条主线站稳之后推进

## 影响范围

后端：

- `api/app/api/routes/workspace_starters.py`
- `api/app/services/workspace_starter_templates.py`
- `api/tests/test_workspace_starter_routes.py`

前端：

- `web/app/page.tsx`
- `web/app/workspace-starters/page.tsx`
- `web/components/workflow-create-wizard.tsx`
- `web/components/workflow-editor-workbench.tsx`
- `web/components/workspace-starter-library.tsx`
- `web/lib/get-workspace-starters.ts`
- `web/lib/workspace-starter-payload.ts`
- `web/app/globals.css`

文档：

- `docs/dev/runtime-foundation.md`
- `docs/dev/2026-03-11-workspace-starter-governance.md`

## 验证

已执行：

```powershell
cd api
.\.venv\Scripts\python.exe -m pytest tests/test_workspace_starter_routes.py
.\.venv\Scripts\ruff.exe check app\api\routes\workspace_starters.py app\services\workspace_starter_templates.py tests\test_workspace_starter_routes.py
```

结果：

- 新增 workspace starter 路由测试 3 项全部通过
- 本轮新增/修改的后端文件 Ruff 检查通过

已执行：

```powershell
cd web
pnpm exec tsc --noEmit
pnpm lint
```

结果：

- `pnpm exec tsc --noEmit` 通过
- `pnpm lint` 通过

补充说明：

- 仓库整体 `ruff check app tests\test_workspace_starter_routes.py` 仍会命中一批历史遗留问题，主要在旧的 `plugins.py`、`runs.py`、`runtime.py`、`plugin_runtime.py` 等文件，不是本轮引入的新错误。

## 下一步

### P0

1. 把 `node catalog / starter template / tool registry` 继续推进到共享后端 contract。
2. 给 workspace starter 治理补第二阶段能力：归档 / 删除、来源 workflow diff、创建页深链回填。

### P1

1. 优先拆 `web/components/workflow-editor-workbench.tsx`，把 run overlay、保存链路和画布壳层拆开。
2. 继续结构化 `llm_agent`、`output`、edge `mapping[]`、join 策略等高频节点能力。

### P2

1. 进入 Dify compat adapter 主线，把外部插件继续压到受约束 `7Flows IR` 再接目录和绑定链路。
2. 在前面三条业务主线站稳后，再继续推进发布配置和开放 API 协议映射。
