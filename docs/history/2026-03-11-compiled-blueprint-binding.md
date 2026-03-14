# 2026-03-11 compiled blueprint 持久化与 run 绑定

## 背景

前一轮 runtime 已经补齐了 `workflow_versions`、durable waiting/resume、artifact/tool/AI 追踪和 callback ingress，但执行入口仍然主要依赖运行前瞬时编译。

这会带来两个问题：

- `workflow_version` 虽然保存了定义快照，但缺少“已经编译好的稳定执行蓝图”这一层事实。
- `runs` 只能记录自己绑定了哪个版本，无法明确记录“本次执行到底用的是哪一份 compiled blueprint”。

这和 `docs/product-design.md`、`docs/technical-design-supplement.md` 里强调的“编译态与运行态要有稳定边界”还有差距，也会拖慢后续 publish binding、开放 API 和回放能力。

## 目标

- 为每个 `workflow_version` 增加持久化的 compiled blueprint 事实。
- 让 workflow 创建/更新时就生成 compiled blueprint，而不是只在运行时临时编译。
- 让 `runs` 显式绑定 `compiled_blueprint_id`，把执行边界从“版本号”推进到“版本 + 编译产物”。
- 保持兼容旧数据：对还没有 compiled blueprint 的旧 workflow version，允许在首次执行时懒回填。

## 决策

本次新增：

1. `workflow_compiled_blueprints`
   - 绑定 `workflow_id / workflow_version_id / workflow_version`
   - 保存 `compiler_version`
   - 保存序列化后的 `blueprint_payload`
2. `CompiledBlueprintService`
   - 负责确保某个 `workflow_version` 有对应的 compiled blueprint
   - 负责把 `FlowCompiler` 的 dataclass blueprint 与 JSON payload 互转
3. `runs.compiled_blueprint_id`
   - 运行开始时显式绑定 compiled blueprint
   - resume 优先复用 run 上绑定的 blueprint，而不是重新走瞬时编译
4. workflow API 响应补充编译态信息
   - `WorkflowVersionItem` 现在会返回 `compiled_blueprint_id`
   - 同时返回 `compiled_blueprint_compiler_version` 和最近更新时间
5. run detail 响应补充 `compiled_blueprint_id`

## 影响范围

- 后端模型与迁移
  - `api/app/models/workflow.py`
  - `api/app/models/run.py`
  - `api/migrations/versions/20260311_0009_compiled_workflow_blueprints.py`
- 编译态与运行态服务
  - `api/app/services/flow_compiler.py`
  - `api/app/services/compiled_blueprints.py`
  - `api/app/services/runtime.py`
- API 与 schema
  - `api/app/api/routes/workflows.py`
  - `api/app/api/routes/runs.py`
  - `api/app/schemas/workflow.py`
  - `api/app/schemas/run.py`
- 测试
  - `api/tests/conftest.py`
  - `api/tests/test_workflow_routes.py`
  - `api/tests/test_runtime_service.py`
  - `api/tests/test_run_routes.py`

## 验证

- `workflow create/update` 现在会同步生成 compiled blueprint，并在 versions 列表里返回对应 ID。
- 结构合法但图有环的 workflow，会在 compiled blueprint 阶段被拒绝，不再等到运行时才暴露。
- `RuntimeService.execute_workflow` 现在会把 run 绑定到 `compiled_blueprint_id`。
- 旧样本如果只有 `workflow_version`、没有 compiled blueprint，会在首次执行时懒回填，不阻断现有流程。
- `resume` 入口会优先解析 run 已绑定的 compiled blueprint，减少对运行前瞬时编译的依赖。

已执行验证：

- `api/.venv/Scripts/python.exe -m pytest`
- `api/.venv/Scripts/python.exe -m ruff check app/api/routes/workflows.py app/services/runtime.py app/models/run.py app/services/flow_compiler.py app/services/compiled_blueprints.py tests/conftest.py tests/test_workflow_routes.py tests/test_runtime_service.py tests/test_run_routes.py`

## 当前边界

- 这次只是把 compiled blueprint 从“瞬时结果”推进到“持久化事实”，还没有把它正式接到发布态 endpoint / protocol mapping。
- `runs` 目前记录了 `compiled_blueprint_id`，但还没有补 execution view / evidence view 的聚合读取接口。
- blueprint 目前仍存为 JSON payload，没有进一步做 checksum、兼容策略或多编译器版本并存治理。

## 下一步

1. 让发布态 endpoint 明确绑定 `workflow_version + compiled_blueprint`，把开放 API 建在稳定执行蓝图上。
2. 围绕 `compiled_blueprint_id + run_artifacts + tool_call_records + ai_call_records` 设计 execution view / evidence view。
3. 继续完善 callback ticket 生命周期治理，包括过期、清理、来源审计和更强鉴权。
