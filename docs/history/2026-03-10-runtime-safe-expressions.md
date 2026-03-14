# Runtime Safe Expressions

## 背景

`docs/history/2026-03-10-runtime-branch-selector-rules.md` 已经给 `condition` / `router` 节点补上了结构化规则选择器，但当前分支与 DAG 仍有两个明显缺口：

- 分支节点只能靠 `selector` 或硬编码 `selected` 做路由，表达能力仍然偏窄。
- 普通 DAG 边仍然只能表达默认成功边、失败边或分支 key，无法在不引入第二套 DSL 的前提下做更细粒度的安全条件判定。

## 目标

在不引入任意代码执行、不过度扩展 `7Flows IR` 的前提下，补一层可校验、可复用的安全表达式能力：

- `condition` / `router` 节点可通过 `config.expression` 决定命中分支
- 普通边可通过 `conditionExpression` 做布尔门控
- 设计态和运行时复用同一套 AST 白名单，避免“两套规则”

## 决策

### 1. 使用受限 AST 表达式，而不是 `eval`

新增公共模块：

- `api/app/core/safe_expressions.py`

只允许非常有限的 Python 表达式子集：

- 常量、列表/元组/字典字面量
- 变量名
- 点访问与下标访问
- `and` / `or` / `not`
- 比较运算
- 三元表达式 `a if cond else b`

显式禁止：

- 函数调用
- 任意对象方法调用
- 算术执行与赋值
- 导入、推导式、lambda 等任意代码能力

### 2. 分支节点表达式语义

#### `condition`

`config.expression` 会被求值为真值：

- truthy -> 选中 `"true"`
- falsy -> 选中 `"false"`

这样可以继续复用现有 `condition` 边值，不需要再引入新的条件节点 DSL。

#### `router`

`config.expression` 会被求值为分支 key：

- 非空结果 -> 转成字符串作为 `selected`
- `None` / 空字符串 / 缺失值 -> 回退到 `config.default`，再回退到 `"default"`

### 3. DAG 边条件表达式

边定义新增：

```json
{
  "conditionExpression": "source_output.approved and source_output.score >= 90"
}
```

表达式上下文当前只暴露安全、稳定的只读对象：

- `source_output`
- `source_node`
- `target_node`
- `edge`
- `outcome`

运行时语义：

- 成功边：先通过原有成功/默认边语义，再判定 `conditionExpression`
- 分支边：先通过分支 key 匹配，再判定 `conditionExpression`
- 失败边：先通过 `failed/error/on_error` 语义，再判定 `conditionExpression`

这让 DAG 条件增强仍然建立在现有 IR 字段之上，没有把边模型拆成第二套结构。

### 4. 设计态前置校验

Schema 层现在会提前拦截：

- 非 `condition/router` 节点使用 `config.expression`
- 非法语法
- 未授权变量名
- 不在白名单内的 AST 节点，例如 `Call`

这样 `POST /api/workflows` 和 `PUT /api/workflows/{id}` 会比运行时更早失败。

## 影响范围

- `api/app/core/safe_expressions.py`
  - 新增共享 AST 白名单校验与求值器
- `api/app/schemas/workflow.py`
  - 新增 `config.expression` 和 `conditionExpression` 校验
- `api/app/services/runtime.py`
  - 新增分支表达式求值
  - 新增普通边条件表达式判定
- `api/tests/test_runtime_service.py`
  - 覆盖 `condition/router` 表达式分支
  - 覆盖普通边布尔表达式门控
- `api/tests/test_run_routes.py`
  - 覆盖 API 侧表达式驱动分支/边门控
- `api/tests/test_workflow_routes.py`
  - 覆盖合法表达式创建与非法表达式拦截

## 验证方式

在 `api/` 目录执行：

```powershell
.\.venv\Scripts\pytest.exe -q
.\.venv\Scripts\python.exe -m ruff check app tests
```

## 当前边界

这一步仍然没有实现：

- 多上游 join / 汇聚语义
- Loop 节点执行
- 模板映射驱动的数据边合流
- 前端表达式配置器和调试可视化
- 发布层对事件/流式响应的表达式映射

## 下一步建议

建议下一步优先做 join / 汇聚约束，而不是继续扩表达式语法：

1. 明确多上游节点何时进入 `ready`
2. 明确同名输入冲突如何合并
3. 在 `run_events` 中补充 join 等待与释放事件
