# compat:dify Tool Discovery

## 背景

前一轮已经补上了 `compat:dify` adapter registration、health probe 和 `/invoke` stub service，
但 adapter 仍然没有“工具目录发现”能力，API 侧也无法从 adapter 拉取 compat 工具并注册到
`PluginRegistry`。这会让 compat 架构停留在“能配置 endpoint，但还不能形成 catalog 闭环”的状态。

## 目标

这轮继续沿着 `7Flows IR` 优先、compat 层旁挂的边界推进，只补最小但真实的 discovery 闭环：

1. `services/compat-dify` 提供只读 `/tools` 接口。
2. adapter 通过本地 Dify manifest/YAML 目录生成 compat 工具目录。
3. `api/` 提供从指定 adapter 拉取并同步工具目录的入口。
4. 保持当前实现诚实，不假装已经完成插件安装、持久化或真实 Dify 执行。

## 实现

### 1. compat-dify 本地 catalog 解析

新增 `services/compat-dify/app/catalog.py`：

- 从 `catalog/` 目录递归发现 `manifest.yaml|yml`
- 读取 `plugins.tools` 指向的 tool YAML
- 按既有设计文档把 Dify 参数类型翻译成 7Flows 兼容的 JSON Schema
- 产出 `compat:dify:plugin:{author}/{name}` 风格的 tool id

当前已经覆盖的参数映射包括：

- `string`
- `number`
- `boolean`
- `select -> string + enum`
- `secret-input -> string + format=password`
- `file -> string + format=uri`

### 2. compat-dify discovery 接口

`services/compat-dify/app/main.py` 新增：

- `GET /tools`

返回值包含：

- `adapter_id`
- `ecosystem`
- `tools[]`

同时继续复用 adapter id header 校验，保证 discovery 和 invoke 走同一条服务边界。

### 3. API 侧 adapter catalog client

`api/app/services/plugin_runtime.py` 新增 `CompatibilityAdapterCatalogClient`：

- 对 adapter 的 `/tools` 发起 HTTP 请求
- 校验 payload 结构
- 校验返回工具的 `ecosystem` 与 adapter registration 一致
- 翻译成 API 侧 `PluginToolDefinition`

### 4. API 侧同步入口

`api/app/api/routes/plugins.py` 新增：

- `POST /api/plugins/adapters/{adapter_id}/sync-tools`

行为：

- 检查 adapter 是否存在且已启用
- 通过 catalog client 拉取 adapter 工具目录
- 将 compat 工具注册到进程内 `PluginRegistry`
- 返回同步结果和当前可调用工具列表

## 边界

这轮仍然没有实现：

- Dify 插件安装/卸载
- manifest 持久化存储
- adapter/tool 注册的重启恢复
- 真实 Dify plugin runtime 执行
- 凭证翻译与密钥托管

因此当前能力应被理解为：

- “真实的 discovery/sync 骨架已经存在”
- 但还不是“完整插件生命周期系统”

## 影响范围

- `services/compat-dify/`
- `api/app/services/plugin_runtime.py`
- `api/app/api/routes/plugins.py`
- `api/app/schemas/plugin.py`
- `api/tests/`

## 验证

本轮计划验证：

- `services/compat-dify/tests/test_adapter_app.py`
- `api/tests/test_plugin_runtime.py`
- `api/tests/test_plugin_routes.py`
- 必要的 `ruff` / `compileall`

## 下一步建议

更合适的后续顺序是：

1. 把 adapter catalog 从本地样例目录推进到“安装产物目录”
2. 给 compat 工具同步增加持久化存储和重启恢复
3. 再接入更真实的 Dify invoke 请求翻译与执行
