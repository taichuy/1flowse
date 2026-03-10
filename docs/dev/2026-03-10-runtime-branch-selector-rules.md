# Runtime Branch Selector Rules

## 背景

`docs/dev/2026-03-10-runtime-branching.md` 让 `condition` / `router` 节点具备了“显式分支可走”的能力，但分支选择本身仍然主要依赖：

- `config.selected`
- `config.mock_output.selected`

这意味着运行时虽然已经支持分支激活，却还没有真正基于输入做判定，`condition` / `router` 仍带有明显占位性质。

## 目标

在不引入任意表达式执行器、不新增第二套内部 DSL 的前提下，为 MVP 运行时补一个安全、可校验、可测试的最小分支求值能力：

- 让 `condition` / `router` 可以基于节点输入决定 `selected`
- 保持对现有 `config.selected` 工作流的兼容
- 在设计态提前拦截脏配置，而不是把错误留到运行时

## 决策

### 1. 分支求值采用结构化规则，而不是直接执行字符串表达式

本步新增 `config.selector`：

```json
{
  "selector": {
    "rules": [
      {
        "key": "urgent",
        "path": "trigger_input.priority",
        "operator": "eq",
        "value": "high"
      }
    ],
    "default": "default"
  }
}
```

其中：

- `rules` 按声明顺序匹配，命中第一条后立即返回其 `key`
- `path` 从当前节点的运行输入里取值，当前主要面向：
  - `trigger_input.*`
  - `upstream.*`
  - `accumulated.*`
- `operator` 当前只支持安全比较子集，不支持任意代码执行

### 2. 默认分支继续复用现有边语义

当规则未命中时：

- 如果配置了 `selector.default`，运行时返回该分支 key
- 如果没有配置，运行时回退到兼容值 `selected="default"`

这样可以继续复用当前“显式条件边 + 无条件兜底边”的出边语义，不需要为默认分支再引入新的边类型。

### 3. 旧配置保持兼容

如果节点没有配置 `selector`，运行时仍然使用：

- `config.selected`
- 若未配置，则回退到 `default`

这样旧测试、旧工作流定义和已有开发记录都不需要被这一步强制迁移。

### 4. 设计态补最小结构校验

当前增加的校验包括：

- `config.selector` 只能出现在 `condition` / `router` 节点上
- `rules` 至少存在一条
- `rules[].key` 必须唯一
- 除 `exists` / `not_exists` 外，其余操作符必须提供 `value`

## 影响范围

- `api/app/schemas/workflow.py`
  - 增加 `config.selector` 的最小结构校验
- `api/app/services/runtime.py`
  - 增加路径读取、比较运算和规则匹配逻辑
  - 为 `condition` / `router` 输出补充 `selector` 调试信息
- `api/tests/test_runtime_service.py`
  - 覆盖规则命中分支
  - 覆盖未命中时走默认分支
- `api/tests/test_run_routes.py`
  - 验证 API 侧可返回规则驱动的分支结果
- `api/tests/test_workflow_routes.py`
  - 验证创建工作流时接受合法 `selector`
  - 验证非分支节点使用 `selector` 会被拒绝

## 验证方式

在 `api/` 目录执行：

```powershell
.\.venv\Scripts\pytest.exe -q
.\.venv\Scripts\python.exe -m ruff check app tests
```

本次结果：

- `pytest`: 25 passed
- `ruff`: All checks passed

## 当前边界

这一步仍然没有实现：

- 通用字符串表达式引擎
- 复合布尔规则（AND / OR / NOT）
- 字段映射与模板表达式驱动的分支判定
- 多上游 join 语义
- 前端对分支规则的可视化配置器

## 下一步建议

建议下一步沿这个结构继续收紧，而不是直接跳到任意表达式：

1. 先把规则选择器扩展为可组合条件
2. 再评估是否需要引入受限表达式引擎
3. 同步补 join / 汇聚语义，避免分支合流继续隐式化
