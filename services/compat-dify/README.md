# compat:dify Adapter Service

这是 `7Flows` 的 `compat:dify` 独立适配服务，用于把 `7Flows IR` 下的 compat tool 调用翻译到 Dify plugin daemon，并把返回结果重新聚合成 7Flows 可消费的结构化输出。

当前目标不是复刻完整 Dify 插件安装生命周期，而是先把 compat adapter 的服务边界、受约束 contract、工具目录发现和真实 invoke 代理固化为可独立启动、可测试、可观察的一条主链。

## 当前能力

- `GET /healthz`
  - 返回 adapter 当前 `status` 与 `mode`
  - `status` 默认使用 `up / degraded / down / disabled` 这组健康语义
- `GET /tools`
  - 从本地 catalog 翻译出受约束 tool 目录
  - 同时暴露 `constrained_ir` 与 compat runtime 线索，供 API registry sync 使用
- `POST /invoke`
  - 先按本地 `executionContract` / `constrained_ir` 校验请求
  - `translate` 模式下仅输出翻译后的 Dify dispatch payload 预览
  - `proxy` 模式下继续把 payload 转发到 Dify plugin daemon，并把流式 `ToolInvokeMessage` 聚合回 7Flows tool runtime 输出

## 边界说明

- `compat:dify` 是外部生态兼容层，不是 sandbox backend。
- `/invoke` 会接收统一的 `execution` 提示与 `executionContract`，但真正的强隔离执行后端仍应走独立的 sandbox backend 协议，而不是把 compat adapter 当作隔离执行注册中心。
- 当前真实代理只覆盖 tool invoke dispatch，不覆盖完整插件安装、凭证托管与持久化恢复。

## 本地运行

```powershell
cd services/compat-dify
..\..\api\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8091
```

## 环境变量

- `SEVENFLOWS_COMPAT_DIFY_ADAPTER_ID`
- `SEVENFLOWS_COMPAT_DIFY_HEALTH_STATUS`
- `SEVENFLOWS_COMPAT_DIFY_DEFAULT_LATENCY_MS`
- `SEVENFLOWS_COMPAT_DIFY_INVOKE_MODE`
- `SEVENFLOWS_COMPAT_DIFY_PLUGIN_DAEMON_URL`
- `SEVENFLOWS_COMPAT_DIFY_PLUGIN_DAEMON_API_KEY`
- `SEVENFLOWS_COMPAT_DIFY_PLUGIN_DAEMON_TENANT_ID`
- `SEVENFLOWS_COMPAT_DIFY_PLUGIN_DAEMON_USER_ID`
- `SEVENFLOWS_COMPAT_DIFY_PLUGIN_DAEMON_APP_ID`
- `SEVENFLOWS_COMPAT_DIFY_PLUGIN_DAEMON_TIMEOUT_MS`

## 调用模式

- `translate`
  - 默认模式
  - `/invoke` 只做 contract 校验与 Dify dispatch payload 翻译
  - 返回值包含脱敏后的 `translatedRequest` 预览，便于 operator 校准 compat 边界
- `proxy`
  - 需要同时配置 `PLUGIN_DAEMON_URL` 和 `PLUGIN_DAEMON_API_KEY`
  - `/invoke` 会把翻译后的 payload 转发到 Dify plugin daemon，并聚合流式输出

## 当前映射假设

由于当前 catalog 仍是 “manifest + tool yaml” 的最小安装产物，而不是完整 Dify 安装数据库，本服务目前会从本地目录推断最小 runtime binding：

- `plugin_id`
  - 优先取 `extra.dify_runtime.plugin_id`
  - 否则退化为 `identity.author`
- `provider`
  - 优先取 `extra.dify_runtime.provider`
  - 否则退化为 manifest 所在目录名
- `tool_name`
  - 优先取 `extra.dify_runtime.tool_name`
  - 否则使用工具 `identity.name`

这足以支撑“真实 payload 翻译 + 受约束代理”的 compat 主链，但还不是完整的 Dify 安装态建模。
