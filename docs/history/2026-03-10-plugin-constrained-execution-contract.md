# 插件受约束执行契约

## 背景

上一轮已经把 `compat:dify` 的工具目录收紧为 `constrained_ir` 入口，但 `/invoke` 仍然停留在 stub 形态：

- API 侧只是在拼装通用 invoke payload
- adapter 侧只校验 `ecosystem` / `adapterId`
- `inputs` / `credentials` 还没有按工具的受约束 IR 做字段级校验

这会让“外部插件先被压缩成受约束 IR”只停留在发现阶段，到了执行阶段又重新变回宽松透传。

## 目标

把 compat 工具调用链继续收口成：

1. API 侧从 `PluginToolDefinition.constrained_ir` 生成受约束执行契约
2. API 侧在发请求前先按契约预校验 `inputs` / `credentials`
3. adapter 侧从本地 catalog 重新恢复执行契约并复核一致性
4. adapter 侧只接受满足契约的字段，不再把任意 payload 当作可执行请求

## 实现

### 1. API 侧补 `executionContract`

`api/app/services/plugin_runtime.py` 中的 `PluginCallProxy` 现在会在 compat 调用前：

- 强制要求工具带有 `constrained_ir`
- 从 `input_contract` + `constraints` 生成 `executionContract`
- 区分 `inputs` 与 `credentials` 的允许字段来源
- 拒绝：
  - 未声明字段
  - 把 credential 字段塞进 `inputs`
  - 把普通输入字段塞进 `credentials`
  - 缺失 required 字段
  - 与最小 JSON Schema 类型/枚举不匹配的值

这样 API 侧不会再把运行时输入原样下发给 adapter。

### 2. compat-dify adapter 复核本地 catalog

`services/compat-dify/app/` 新增：

- `catalog.py`
  - `get_catalog_tool()`
  - `build_execution_contract()`
- `invocation.py`
  - `validate_invocation_request()`

`/invoke` 现在会：

- 先用 `toolId` 在本地 catalog 查找工具
- 从本地 `constrained_ir` 重新构造执行契约
- 与请求中的 `executionContract` 做一致性比对
- 再按契约校验 `inputs` / `credentials`

如果 catalog 已变化、字段来源不一致、或调用方带了额外字段，adapter 会直接拒绝，而不是继续执行。

### 3. stub 输出保持诚实

这轮仍然没有实现真实 Dify runtime invoke 翻译，所以 adapter 输出继续保持 stub 语义，但会明确返回：

- 经过校验的 `received`
- `credentialFields` 名称列表（不回显 secret 值）
- 执行契约摘要

这能证明“执行契约已经生效”，但不会假装真实插件执行已完成。

## 影响范围

- `api/app/services/plugin_runtime.py`
- `api/tests/test_plugin_runtime.py`
- `services/compat-dify/app/schemas.py`
- `services/compat-dify/app/catalog.py`
- `services/compat-dify/app/invocation.py`
- `services/compat-dify/app/main.py`
- `services/compat-dify/tests/test_adapter_app.py`

## 验证

执行：

```powershell
E:\code\taichuCode\7flows\api\.venv\Scripts\python.exe -m pytest api/tests/test_plugin_runtime.py api/tests/test_plugin_routes.py
E:\code\taichuCode\7flows\api\.venv\Scripts\python.exe -m pytest services/compat-dify/tests/test_adapter_app.py
E:\code\taichuCode\7flows\api\.venv\Scripts\python.exe -m compileall services/compat-dify/app api/app/services/plugin_runtime.py
```

结果：

- API plugin runtime / routes 用例通过
- compat-dify adapter app 用例通过
- 相关代码可正常编译

## 当前边界

这轮仍然没有实现：

- 真实 Dify invoke payload 翻译
- 插件安装产物持久化与重启恢复
- 节点配置表单自动消费 `executionContract`
- provider / datasource / trigger 等其他插件类型的执行契约

## 下一步

更连续的后续顺序是：

1. 在当前执行契约上叠加“真实 Dify invoke payload 翻译”，但继续以本地 `constrained_ir` 为事实来源
2. 把 sync 下来的 compat 工具目录持久化，避免重启丢失
3. 评估让节点配置页直接复用 `constrained_ir` / `executionContract` 生成表单
