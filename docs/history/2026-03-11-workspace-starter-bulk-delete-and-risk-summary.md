# Workspace Starter 批量删除与风险摘要

## 背景

上一轮已经把 workspace starter 治理推进到“可按结果集批量 archive / restore / refresh / rebase”，但仍有两个直接影响团队治理效率的缺口：

- 已归档模板仍只能逐个永久删除，治理页缺少结果集级的收尾能力。
- 批量操作完成后，前端只能看到“跳过了几个”，还看不到更清晰的跳过原因聚合和风险提示。

这两个问题都落在当前 `P0 应用新建编排` 主线，继续拖延只会让团队模板库越来越难治理。

## 目标

- 为 workspace starter bulk API 增加 `delete` 动作，并继续遵守“先归档再删除”的治理规则。
- 让批量结果显式返回 `deleted_items` 与 `skipped_reason_summary`，方便 UI 展示风险和跳过原因。
- 顺手控制治理页体量，避免在已有长文件上继续直接堆 bulk 交互。

## 实现

### 1. 后端 bulk contract 补齐 delete

`POST /api/workspace-starters/bulk` 现在支持：

- `archive`
- `restore`
- `refresh`
- `rebase`
- `delete`

其中 `delete` 只处理已归档模板；未归档模板会被跳过，并返回：

- `reason = delete_requires_archive`
- `detail = "Archive the workspace starter before deleting it."`

### 2. 删除路径补上 history 清理

单条删除和批量删除现在都会先清理 `workspace_starter_history`，再删除模板记录，避免真实数据库里出现：

- 外键阻塞删除
- 孤儿治理历史

这样“删除模板”继续保持为完整治理动作，而不是只删主表。

### 3. 批量结果增加风险摘要

bulk 返回体新增：

- `deleted_items`
- `skipped_reason_summary`

前端现在可以直接展示：

- 本次批量操作删除了哪些 starter
- 跳过原因分别出现了几次
- 当前 bulk action 对应的风险提示

不需要再由治理页临时拼装一套 reason 统计逻辑。

### 4. 前端 bulk 区块拆成子组件

新增 `web/components/workspace-starter-library/bulk-governance-card.tsx`，把 bulk governance 的：

- 操作计数
- 风险提示
- 最近一次 bulk 结果摘要
- 批量操作按钮

从 `workspace-starter-library.tsx` 中抽离出来，避免治理页主文件继续无边界增长。

## 影响范围

- `api/app/api/routes/workspace_starters.py`
- `api/app/schemas/workspace_starter.py`
- `api/app/services/workspace_starter_templates.py`
- `api/tests/test_workspace_starter_routes.py`
- `web/components/workspace-starter-library.tsx`
- `web/components/workspace-starter-library/bulk-governance-card.tsx`
- `web/lib/get-workspace-starters.ts`

## 验证

- 后端：`api/.venv/Scripts/python.exe -m pytest tests/test_workspace_starter_routes.py`
- 前端：`pnpm exec tsc --noEmit`
- 前端：`pnpm lint`

验证结果：

- bulk delete、skip summary 和原有 starter routes 全部通过测试
- TypeScript 类型检查通过
- ESLint 通过

## 当前结论

- workspace starter 治理已经从“可批量变更”进一步推进到“可批量收尾”。
- 批量操作不再只返回一个模糊数字，而是开始具备团队真正可用的风险摘要。
- 治理页继续维持“后端事实统一产出，前端负责摘要与操作入口”的边界，没有把 bulk 风险规则重新写回页面本地状态。

## 下一步

1. 继续把 bulk 结果从“摘要”推进到“可钻取列表 + 快速跳转”，让团队能更快复核哪些模板被跳过、为什么被跳过。
2. 把 `workflow library snapshot` 继续推进到 `plugin-backed node source` 和统一 node/tool source contract，避免主业务入口再次退回前端本地常量拼装。
3. 继续拆治理页中仍偏重的筛选栏和详情表单，防止 `workspace-starter-library.tsx` 在下一轮功能扩展时再次长回单文件混排。
