# Runtime Join Policy

## 背景

在补完分支、失败路径、重试和安全表达式之后，运行时已经能表达较真实的 DAG 控制流，但多上游节点仍然存在一个空白：

- 当前下游节点只要命中了任一上游激活边，就会执行
- 当节点事实上需要多个上游结果一起到齐时，运行时缺少显式约束
- 分支合流是否允许“部分到达也继续跑”，此前只能靠节点实现方自己兜底

这会让多上游语义继续停留在隐式约定层，而不是 7Flows IR 可追踪的运行时策略。

## 目标

先补一个最小但明确的 join 约束，不在这一步直接展开完整汇聚 DSL：

- 允许节点声明多上游 join 策略
- 明确 required sources 未满足时是 `skip` 还是 `fail`
- 把 join 判定结果写进节点输入和事件流，便于调试

## 决策

### 1. join 放在 `runtimePolicy.join`

新增结构：

```json
{
  "runtimePolicy": {
    "join": {
      "mode": "all",
      "requiredNodeIds": ["planner", "researcher"],
      "onUnmet": "fail"
    }
  }
}
```

字段语义：

- `mode`
  - `any`: 兼容当前行为，只要至少一个上游激活即可执行
  - `all`: 只有 required sources 全部激活后才执行
- `requiredNodeIds`
  - 可选
  - 为空时，`all` 模式默认要求所有入边来源节点
- `onUnmet`
  - `skip`: join 未满足时跳过该节点
  - `fail`: join 未满足时将该节点记为 `blocked` 并使 Run 失败

### 2. 默认策略保持兼容

为了不把已有分支工作流全部打断，默认仍然是：

```json
{
  "runtimePolicy": {
    "join": {
      "mode": "any",
      "onUnmet": "skip"
    }
  }
}
```

也就是说，本次是把 join 约束“做出来”，而不是直接把所有多上游节点强制切成严格合流。

### 3. 设计态前置校验

Schema 层新增约束：

- `trigger` 节点不能声明 `runtimePolicy.join`
- 没有入边的节点不能声明 `runtimePolicy.join`
- `requiredNodeIds` 必须唯一
- `requiredNodeIds` 必须属于该节点真实入边来源

这样非法 join 配置会在创建/更新工作流时直接被拒绝。

### 4. 运行时观测

运行时现在会把 join 信息注入到 `node_input.join`：

- `mode`
- `onUnmet`
- `expectedSourceIds`
- `activatedSourceIds`
- `missingSourceIds`

同时新增事件：

- `node.join.ready`
  - 多上游 `all` 模式已满足，可以执行
- `node.join.unmet`
  - join 未满足，随后会进入 `skipped` 或 `blocked`

其中 `blocked` 节点用于表达“join 明确要求到齐，但运行时没有满足，因此阻断执行”。

## 影响范围

- `api/app/schemas/workflow.py`
  - 新增 `runtimePolicy.join` 结构与图约束
- `api/app/services/runtime.py`
  - 新增 join 判定、`blocked` 节点记录、join 事件
- `api/tests/test_runtime_service.py`
  - 覆盖 `join=all` 成功
  - 覆盖 `join=all + onUnmet=fail` 失败
- `api/tests/test_run_routes.py`
  - 覆盖 API 层 join 输入/事件暴露
- `api/tests/test_workflow_routes.py`
  - 覆盖 join 配置校验

## 验证方式

在 `api/` 目录执行：

```powershell
.\.venv\Scripts\pytest.exe -q
.\.venv\Scripts\python.exe -m ruff check app tests
```

本次结果：

- `pytest`: 39 passed
- `ruff`: All checks passed

## 当前边界

这一步仍然没有实现：

- `Edge.mapping` 驱动的字段级汇聚
- 同名目标字段冲突解决策略
- 基于表达式/模板的汇聚变换
- Loop 节点的迭代 join
- 前端 join 可视化配置器

## 下一步建议

建议继续按下面顺序推进：

1. 落 `Edge.mapping` 的最小字段映射与 merge 策略
2. 再接 Dify 插件兼容代理
3. 把 `run_events` 接进前端调试面板
