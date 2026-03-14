# Runtime Edge Mapping

## 背景

在补上安全表达式和显式 join 之后，运行时已经能正确决定“哪些边会激活、哪些多上游节点可以执行”，但节点间数据传递仍然偏粗：

- 默认只把上游输出按 `sourceNodeId -> output` 原样挂到 `upstream`
- 下游节点无法通过 IR 显式声明“把上游某个字段映射成我的输入字段”
- 多个上游映射到同一路径时，也缺少明确的 merge 规则

这与 `docs/technical-design-supplement.md` 中“Edge `mapping` 是平台内部数据通道”的方向还存在落差。

## 目标

先落一个最小但真实可用的 `Edge.mapping`：

- 支持从上游输出提取字段并注入到下游输入
- 支持最小变换子集
- 支持多源写同一路径时的显式 merge 策略
- 保持 `upstream` 的原始按来源分组结果，避免破坏现有节点语义

## 决策

### 1. 数据输入分成 `upstream` 和 `mapped`

运行时现在同时维护两层输入：

- `upstream`
  - 保留旧行为
  - 结构为 `sourceNodeId -> source output`
- `mapped`
  - 来自 `Edge.mapping`
  - 按 `targetField` 写入字段级输入

节点实际看到的：

- `upstream`: 原始来源输出
- `mapped`: 显式映射后的字段
- `accumulated`: 若存在 `mapped`，则优先返回 `mapped`；否则回退到 `upstream`

同时，`mapped` 也会 overlay 到节点输入根对象上，所以像 `prompt`、`config.query` 这样的映射字段可直接被节点消费。

### 2. 本次支持的最小 `FieldMapping`

当前支持：

```json
{
  "sourceField": "plan.title",
  "targetField": "prompt",
  "transform": { "type": "toString" },
  "template": "Draft: {{value}}",
  "fallback": "N/A"
}
```

已支持的 transform：

- `identity`
- `toString`
- `toNumber`
- `toBoolean`

当前还没有支持：

- `jsonParse`
- `jsonStringify`
- `template` 之外的复杂模板能力
- `expression`
- `jmesPath`

### 3. merge 策略放在 `runtimePolicy.join.mergeStrategy`

多源写同一路径的冲突，不继续靠“谁后写入谁生效”，而是显式声明：

```json
{
  "runtimePolicy": {
    "join": {
      "mode": "all",
      "mergeStrategy": "append"
    }
  }
}
```

当前支持：

- `error`
  - 默认值
  - 发现同一路径冲突时直接失败
- `overwrite`
  - 后写覆盖先写
- `keep_first`
  - 保留最先写入的值
- `append`
  - 聚合为数组

### 4. 目标路径限制

为避免破坏运行时保留字段，`targetField` 目前不能写入这些根路径：

- `trigger_input`
- `upstream`
- `accumulated`
- `mapped`
- `activated_by`
- `authorized_context`
- `attempt`
- `join`

允许写入：

- 普通自定义输入字段，如 `prompt`
- `config.*`
- 其他业务路径，如 `metadata.note`

### 5. Output 节点改为优先返回 `accumulated`

此前 `output` 节点只返回 `upstream`。现在改为：

- 有 `mapping` 时返回映射后的 `accumulated`
- 无 `mapping` 时仍保持旧行为（`accumulated == upstream`）

这样 Output 节点终于可以承担最小结果整形职责，而不是只能原样透传来源输出。

## 影响范围

- `api/app/schemas/workflow.py`
  - 新增最小 `FieldMapping` / transform schema
  - 新增 `join.mergeStrategy`
  - 新增 `targetField` 保留根路径约束
- `api/app/services/runtime.py`
  - 新增 `mapped` 输入层
  - 新增字段提取、变换、模板渲染和 merge 逻辑
  - `output` 节点改为返回 `accumulated`
- `api/tests/test_runtime_service.py`
  - 覆盖字段映射
  - 覆盖 `append` merge
  - 覆盖默认冲突失败
- `api/tests/test_run_routes.py`
  - 覆盖 API 层映射结果暴露
- `api/tests/test_workflow_routes.py`
  - 覆盖映射定义创建
  - 覆盖非法 `targetField` 拦截

## 验证方式

在 `api/` 目录执行：

```powershell
.\.venv\Scripts\pytest.exe -q
.\.venv\Scripts\python.exe -m ruff check app tests
```

本次结果：

- `pytest`: 45 passed
- `ruff`: All checks passed

## 当前边界

这一步仍然没有实现：

- `FieldTransform.expression`
- `FieldTransform.jmesPath`
- Mustache 风格多变量模板渲染
- 数组/对象级复杂合并策略
- 前端 Edge mapping 编辑器

## 下一步建议

运行时基础这一层已经比较完整，建议后续顺序回到：

1. Dify 插件兼容代理
2. `run_events` 接前端调试面板
3. 更完整的 `7Flows IR` 校验和发布态版本治理
