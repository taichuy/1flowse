# Rust Provider Plugin Runtime And Distribution Design

日期：2026-04-19  
状态：讨论稿，等待确认

## 1. 背景

当前插件体系已经确认两条稳定边界：

- 正式安装对象是 `.1flowbasepkg`，不是源码目录。
- 生产安装态不再现场执行 `pip install` 或 `npm install`。

本设计在此基础上进一步收口 provider plugin 的正式产品形态：

- 插件作者开发的是源码仓库。
- 宿主安装和运行的是预编译正式产物。
- provider plugin 的推荐实现语言固定为 `Rust`。
- 用户安装时不需要关心 Docker / 物理机，也不需要自己区分 `amd64 / arm64`。

## 2. 目标

- 给生态开发者一条稳定、低歧义的开发与发布路径。
- 给最终用户一条真正可一键安装的产品路径。
- 让 Docker 部署与物理机部署共用一套插件规范。
- 让多架构发布在 registry 和安装器层闭合，不把复杂度推给用户。

## 3. 非目标

- 不考虑旧版 Node.js provider runtime 的兼容层。
- 不引入插件容器镜像作为首轮正式分发形态。
- 不要求宿主机安装 Rust 开发工具链。
- 不把源码目录安装保留为正式线上能力。

## 4. 核心结论

- 插件作者开发 Rust 源码仓库。
- CI 构建并发布多架构 `.1flowbasepkg`。
- 官方 registry 按“一个逻辑版本，多 target artifact”发布。
- 宿主安装时根据自己当前运行平台自动选择 artifact。
- `plugin-runner` 运行的是包内预编译可执行文件，而不是脚本模块。

## 5. 开发者工作流

生态开发者的工作流固定为：

1. 基于官方模板创建 provider plugin 源码仓库。
2. 用 Rust SDK 实现 provider runtime 协议。
3. 本地通过 `cargo run` 或 `plugin dev` 调试。
4. 本地运行插件测试、协议测试、示例调用测试。
5. CI 交叉编译 Linux `amd64` 与 Linux `arm64` 二进制。
6. CI 将每个 target 打包为对应 `.1flowbasepkg`。
7. CI 对产物做 checksum 与签名。
8. CI 更新 registry 元数据并发布 release。

开发者面对的是源码仓库，而不是安装包。

## 6. 用户安装工作流

最终用户的安装动作始终是“安装插件”。

宿主内部执行顺序固定为：

1. 从 registry 获取逻辑插件版本信息。
2. 识别当前宿主运行平台。
3. 在同一逻辑版本下选择匹配 target artifact。
4. 下载对应 `.1flowbasepkg`。
5. 校验 checksum 与签名。
6. 解压到宿主安装目录。
7. 写入 installation 记录。
8. 启用并分配到当前 workspace。
9. 通知 `plugin-runner` 加载对应 installation。

用户不需要知道：

- 当前宿主是否运行在 Docker 中。
- 当前宿主是 `amd64` 还是 `arm64`。
- 插件由哪种语言实现。

## 7. Docker 与物理机统一模型

插件规范不区分 Docker 与物理机。

统一规则只有两条：

- 插件安装目录必须持久化。
- 宿主当前 `os / arch / libc` 必须可被安装器识别。

在物理机部署中，插件目录直接落本地文件系统。  
在 Docker 部署中，插件目录必须挂载到持久卷。  
插件安装器只读取“当前宿主运行平台”，不读取“当前是否在容器中”。

建议宿主固定维护以下目录：

- `/var/lib/1flowbase/plugin-packages`
- `/var/lib/1flowbase/plugin-installed`
- `/var/lib/1flowbase/plugin-working`

## 8. 多架构分发策略

首轮正式方案固定为：

- 一个逻辑插件版本
- 多个 target artifact

例如：

- `openai_compatible@0.2.1` 是逻辑版本
- `linux-amd64`、`linux-arm64` 是 target artifact

不采用“一个包塞全部架构”的统一 fat package 作为默认正式方案。原因：

- 产物更大
- 签名与回滚粒度更粗
- 后续支持更多 target 时扩张过快

可选地，后续可把 fat package 作为离线场景增强能力，而不是默认正式分发形态。

## 9. 目标平台

首轮正式支持目标固定为：

- `x86_64-unknown-linux-musl`
- `aarch64-unknown-linux-musl`

原因：

- 贴近当前宿主主要部署场景
- 尽量降低 glibc / 发行版差异
- 不要求宿主具备 Rust toolchain

## 10. 包结构

`openai_compatible` 的正式安装产物示例：

```text
manifest.yaml
provider/openai_compatible.yaml
bin/openai_compatible-provider
i18n/en_US.json
i18n/zh_Hans.json
models/llm/_position.yaml
models/llm/openai_compatible_chat.yaml
icon.svg
_meta/official-release.json
_meta/official-release.sig
```

源码仓库可额外包含：

- `src/`
- `Cargo.toml`
- `readme/`
- `demo/`
- 开发态 `scripts/`

其中 `demo/` 与开发态脚本默认不进入正式安装包。

## 11. Manifest 规范

正式 manifest 建议如下：

```yaml
schema_version: 2
plugin_type: model_provider
plugin_code: openai_compatible
version: 0.2.1
contract_version: 1flowbase.provider/v1

metadata:
  author: taichuy
  icon: icon.svg
  label:
    en_US: OpenAI-Compatible API Provider
    zh_Hans: OpenAI 兼容接口供应商
  description:
    en_US: Provider plugin for services that expose an OpenAI-compatible API surface.
    zh_Hans: 面向 OpenAI 兼容接口服务的模型供应商插件。

provider:
  definition: provider/openai_compatible.yaml

runtime:
  kind: executable
  protocol: stdio-json

limits:
  memory_bytes: 268435456
  invoke_timeout_ms: 30000

capabilities:
  model_types:
    - llm

compat:
  minimum_host_version: 0.1.0
```

字段约束：

- `plugin_code`：插件稳定标识。
- `version`：逻辑版本，不含架构维度。
- `runtime.kind`：首轮只允许 `executable`。
- `runtime.protocol`：首轮只允许 `stdio-json`。
- `limits`：只描述宿主可强制执行的限制。
- `capabilities.model_types`：声明可接入的模型能力。

## 12. Registry 规范

官方 registry 需要表达“一个逻辑版本，多 artifact”：

```json
{
  "plugin_id": "1flowbase.openai_compatible",
  "provider_code": "openai_compatible",
  "display_name": "OpenAI-Compatible API Provider",
  "latest_version": "0.2.1",
  "artifacts": [
    {
      "os": "linux",
      "arch": "amd64",
      "libc": "musl",
      "download_url": "https://github.com/taichuy/1flowbase-official-plugins/releases/download/openai_compatible-v0.2.1/1flowbase@openai_compatible@0.2.1@linux-amd64@8f3c4d7a9b2e1c6d5f0a4b8c3d7e1f2a6b9c0d4e8f1a2b3c4d5e6f7a8b9c0d1e.1flowbasepkg",
      "checksum": "sha256:8f3c4d7a9b2e1c6d5f0a4b8c3d7e1f2a6b9c0d4e8f1a2b3c4d5e6f7a8b9c0d1e",
      "signature_algorithm": "ed25519",
      "signing_key_id": "official-key-1"
    },
    {
      "os": "linux",
      "arch": "arm64",
      "libc": "musl",
      "download_url": "https://github.com/taichuy/1flowbase-official-plugins/releases/download/openai_compatible-v0.2.1/1flowbase@openai_compatible@0.2.1@linux-arm64@5a1d9e4c7b2f6a8d3c0e4b7a1f9d2c6e8b3a5d7c1e9f2a4b6d8c0e2f4a6b8d0c.1flowbasepkg",
      "checksum": "sha256:5a1d9e4c7b2f6a8d3c0e4b7a1f9d2c6e8b3a5d7c1e9f2a4b6d8c0e2f4a6b8d0c",
      "signature_algorithm": "ed25519",
      "signing_key_id": "official-key-1"
    }
  ]
}
```

registry 中的 `version` 仍然表示逻辑版本，而不是 target 维度版本。

## 13. plugin-runner 最小运行协议

`plugin-runner` 首轮只承担以下职责：

- 加载 installation 对应的包目录
- 识别并执行包内 provider 可执行文件
- 用统一 `stdio-json` 协议与 provider 交互
- 执行 timeout 与 memory limit
- 收集退出码、stderr、协议错误并映射为宿主标准错误

provider 可执行文件最小接口固定为：

- 启动后从 `stdin` 读取 JSON request
- 向 `stdout` 输出 JSON response
- `stderr` 仅用于诊断日志
- 退出码非 `0` 视为运行失败

首轮不要求 provider 实现长驻进程复用；但宿主实现不应排斥后续演进到长驻 worker。

## 14. 作者与示例口径

插件规范中的作者字段默认使用当前项目作者：

- `taichuy`

规范示例统一优先使用当前现有官方插件：

- `openai_compatible`

这样可以让规范、当前目录结构和后续真实实现逐项对照，不再引入外部项目作者或不必要的新插件名。

## 15. 结论

正式插件规范应固定为：

- Rust 源码开发
- CI 交叉编译
- 多 target `.1flowbasepkg` 分发
- registry 负责 target 选择信息
- 宿主自动按当前平台选择安装包
- Docker 与物理机只在插件目录持久化方式上有部署差异，不在插件规范层分叉

这是当前阶段对生态开发者与最终用户都最清晰、可执行、可治理的方案。
