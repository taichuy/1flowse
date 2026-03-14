# 2026-03-11 Workspace Starter 治理补齐：来源刷新与操作历史

## 背景

上一轮提交已经把 workflow editor 拆分到更清晰的组件层，并把 `workflow library snapshot` 接成创建页和 editor 的共享事实来源。

但 `workspace starter` 治理页仍停留在“能看漂移、能改元数据、能归档”的阶段：

- 可以看到源 workflow 是否漂移
- 不能直接把模板快照刷新到最新源版本
- 治理动作没有独立历史，后续 AI / 人类都难以追溯“谁动过模板、动了什么”
- 前端若继续在单个治理组件里堆叠来源治理逻辑，很容易把刚拆开的结构再长回去

这已经直接卡在 P0 主线“应用新建编排 -> workspace starter 团队资产治理”的完整度上。

## 目标

本轮先补一条最小但真实可用的治理闭环：

1. 支持从源 workflow 刷新 workspace starter 的 definition 快照
2. 为治理动作补持久化历史记录
3. 把治理页从“只读漂移面板”推进到“可执行刷新 + 可查看历史”
4. 控制 `workspace-starter-library.tsx` 继续膨胀，避免新逻辑再次回灌到单文件

## 实现与决策

### 1. 后端新增 workspace starter 治理历史表

新增：

- `workspace_starter_history`

字段聚焦于治理追溯，而不是运行态日志：

- `template_id`
- `workspace_id`
- `action`
- `summary`
- `payload`
- `created_at`

当前记录的动作：

- `created`
- `updated`
- `archived`
- `restored`
- `refreshed`

这里刻意没有把它塞进 `run_events`：

- `run_events` 负责运行态事实
- `workspace starter history` 负责设计态资产治理事实

两者职责不同，避免把“模板治理”错误混入运行追踪。

### 2. 新增来源刷新动作

新增接口：

- `GET /api/workspace-starters/{template_id}/history`
- `POST /api/workspace-starters/{template_id}/refresh`

`refresh` 的当前语义是：

- 必须存在 `created_from_workflow_id`
- 从源 workflow 读取当前 definition
- 通过现有 workflow definition 校验复用统一约束
- 若源 definition 或版本号发生变化，则更新 starter 快照与 `created_from_workflow_version`
- 无论是否发生变化，都记录一次治理历史，明确本次刷新是否真正改动了快照

本轮刻意只做 `refresh`，没有一口气补 `rebase`：

- `refresh` 先解决“团队模板和源 workflow 已漂移却无法同步”的最直接阻塞
- `rebase` 仍需要更清晰的治理语义，例如哪些元数据跟随源 workflow，哪些治理信息必须保留
- 在这些规则没定清楚之前，不适合把两个动作混成一个模糊按钮

### 3. 前端治理页升级为“可刷新 + 可追溯”

治理页新增：

- 来源状态卡片里的“从源 workflow 刷新快照”动作
- 单独的治理历史面板

同时把新增区块拆到独立子组件：

- `web/components/workspace-starter-library/source-status-card.tsx`
- `web/components/workspace-starter-library/history-panel.tsx`

这样 `workspace-starter-library.tsx` 继续保留状态编排和页面级组装，而不是重新吞回来源治理与历史展示细节。

## 影响范围

后端：

- `api/app/models/workspace_starter.py`
- `api/app/schemas/workspace_starter.py`
- `api/app/services/workspace_starter_templates.py`
- `api/app/api/routes/workspace_starters.py`
- `api/migrations/versions/20260311_0006_workspace_starter_history.py`

前端：

- `web/components/workspace-starter-library.tsx`
- `web/components/workspace-starter-library/source-status-card.tsx`
- `web/components/workspace-starter-library/history-panel.tsx`
- `web/lib/get-workspace-starters.ts`

测试：

- `api/tests/test_workspace_starter_routes.py`

## 验证

已完成：

- `api\\.venv\\Scripts\\python.exe -m pytest tests\\test_workspace_starter_routes.py`
- `api\\.venv\\Scripts\\python.exe -m ruff check app\\api\\routes\\workspace_starters.py app\\models\\workspace_starter.py app\\schemas\\workspace_starter.py app\\services\\workspace_starter_templates.py tests\\test_workspace_starter_routes.py`
- `pnpm exec tsc --noEmit`（`web/`）
- `pnpm lint`（`web/`）

结果：

- workspace starter 路由测试通过，覆盖历史记录与刷新动作
- 本轮触达的后端文件 Ruff 通过
- 前端 TypeScript 检查通过
- 前端 lint 通过

## 当前结论

- 项目基础框架已经足够继续支撑主业务推进，不再是“只有底座没有业务闭环”
- `workspace starter` 已从“可保存、可归档”进入“可刷新、可追溯”的团队资产治理阶段
- 架构上仍保持相对解耦：
  - workflow 设计态
  - workspace starter 治理态
  - 运行态 run / node_run / run_event
  已经是三条相对清晰的事实链路

## 未决问题与下一步

仍未完成：

- workspace starter `rebase`
- 批量治理操作
- 更细的来源 diff / 对比视图
- workflow library 对 `plugin-backed node source` 的真实接入

建议下一步继续按优先级推进：

1. 在 workspace starter 第三阶段继续补 `rebase`、批量操作和更清晰的来源 diff
2. 把 `workflow library snapshot` 扩到 plugin-backed node/tool source contract
3. 再回到节点主线，继续补 edge mapping、join 与更细的 schema 配置
