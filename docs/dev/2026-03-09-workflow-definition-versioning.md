# 2026-03-09 工作流定义校验与版本快照

## 背景

在运行时基础设施落地后，`workflow.definition` 仍然以裸 JSON 形式进入数据库和执行器：

- 编排 API 缺少结构约束
- 定义更新没有版本快照
- `runs` 无法标记执行时绑定的是哪一版工作流

这会直接影响后续三条主线：

- 执行器语义增强时缺少稳定输入契约
- MCP 授权与上下文查询无法绑定明确版本
- 调试、发布、缓存和审计无法可靠追溯

## 目标

为当前 MVP 落一个“最小但真实可用”的设计态基础：

- 创建/更新工作流时执行结构校验
- 每次定义变更生成不可变版本快照
- 运行记录绑定执行时的工作流版本
- 保持实现范围克制，不提前引入完整发布治理或灰度发布模型

## 实现

### 1. 工作流定义校验

新增 `api/app/schemas/workflow.py` 中的结构化定义模型，当前覆盖运行时已实际依赖的 IR 子集：

- `nodes`
- `edges`
- `variables`
- `publish`
- `trigger`

当前校验规则：

- 必须且仅允许一个 `trigger` 节点
- 至少包含一个 `output` 节点
- 节点 ID 唯一
- 连线 ID 唯一
- 连线引用的源/目标节点必须存在
- 连线不允许自指
- 连线默认补齐 `channel=control`

说明：

- 这里刻意只校验“当前实现已经能消费”的最小 IR 子集
- 没有在这一步就把完整发布态、权限态、Loop 语义一次性做满
- `loop` 节点在定义上允许存在，但仍由运行时决定是否可执行

### 2. 最小版本管理

新增 `workflow_versions` 表保存不可变快照。

当前策略：

- 新建工作流时创建初始版本 `0.1.0`
- 仅当 `definition` 变更时自动递增 patch 版本
- 名称修改不创建新版本
- `workflows` 保存当前头版本
- `workflow_versions` 保存历史快照

这是一个“保存即生成版本”的最小实现，不等同于中长期目标里的“发布版治理”。

当前没有实现：

- 草稿版 / 发布版分叉
- 灰度发布
- 发布别名绑定
- 版本回滚 UI

### 3. 运行态绑定版本

在 `runs` 表新增 `workflow_version` 字段，执行工作流时直接把当前版本写入运行记录。

这样后续可以在不改 Run 主模型的前提下继续承接：

- 调试回放
- 发布态路由
- 缓存失效
- 审计追踪

## 影响范围

- `api/app/models/workflow.py`
- `api/app/models/run.py`
- `api/app/schemas/workflow.py`
- `api/app/schemas/run.py`
- `api/app/services/runtime.py`
- `api/app/services/workflow_definitions.py`
- `api/app/api/routes/workflows.py`
- `api/app/api/routes/runs.py`
- `api/migrations/versions/20260309_0002_workflow_versioning.py`
- `api/tests/conftest.py`
- `api/tests/test_workflow_routes.py`
- `api/tests/test_run_routes.py`
- `api/tests/test_runtime_service.py`

## 验证

执行：

```powershell
cd api
.\.venv\Scripts\python -m pytest
.\.venv\Scripts\python -m ruff check app tests
```

验证覆盖：

- 合法工作流可创建并生成初始版本
- 非法定义会被 API 拒绝
- 更新定义会生成新版本快照并递增 patch 版本
- Run 会记录执行时的 `workflow_version`

## 未决问题

1. 当前版本号是“保存时递增”，后续是否要改成“发布时递增”需要结合发布网关一起定。
2. `publish` 结构目前只做最小结构校验，尚未建立与版本治理的强绑定关系。
3. 未来如果要支持草稿态与发布态并存，`workflows` 和 `workflow_versions` 之间还需要补“当前草稿头”和“当前发布头”的分离模型。
