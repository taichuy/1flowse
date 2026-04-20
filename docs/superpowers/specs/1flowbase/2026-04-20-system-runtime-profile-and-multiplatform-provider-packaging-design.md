# 1flowbase 宿主运行时画像、多平台 Provider 打包与账号语言闭环设计稿

日期：2026-04-20
状态：已确认设计，待用户审阅

关联文档：
- [2026-04-19-rust-provider-plugin-runtime-distribution-design.md](./2026-04-19-rust-provider-plugin-runtime-distribution-design.md)
- [2026-04-18-model-provider-integration-design.md](./2026-04-18-model-provider-integration-design.md)
- [modules/08-plugin-framework/README.md](./modules/08-plugin-framework/README.md)

## 1. 文档目标

本文档用于收口 `1flowbase` 在 Rust-first provider runtime distribution 完成后的下一轮宿主能力设计，明确：

- 多平台 provider 打包与官方 release 链如何从 Linux 扩到 `Windows / macOS`
- 宿主如何输出独立的 `runtime-profile`，而不是继续把诊断信息塞进 `/health`
- `api-server` 如何聚合 `plugin-runner` 运行态，并判断是否同机部署
- 账号级 `preferred_locale` 如何补齐，形成真实语言偏好闭环
- 后端与国际化的边界如何定义，避免后端变成“翻译器”
- 官方目录、已安装插件目录、model provider 相关接口如何统一暴露插件 i18n 资源

## 2. 背景与问题

`2026-04-19` 已完成的 Rust provider runtime distribution 设计已经明确并落地了以下事实：

- 正式 provider 安装对象是 `.1flowbasepkg`
- 默认正式分发策略是 `thin package`，不是 fat package
- `plugin-runner` 正式执行的是包内可执行文件，而不是 Node.js entrypoint
- 官方 registry 已经切到 latest-only + `artifacts[]`

但当前主仓库仍然存在四类缺口：

### 2.1 平台支持仍然偏 Linux

当前 `RuntimeTarget` 和官方 release workflow 仍主要围绕 Linux `musl`：

- host target 识别未完整覆盖 `macOS / Windows`
- package CLI 未统一处理 `.exe`
- official plugin release workflow 仍未形成完整多 runner 分工

这会导致 host 逻辑已经支持“按平台选 artifact”，但官方分发面还不是完整的多平台产品链。

### 2.2 `/health` 不适合继续承载诊断能力

当前 `api-server` 与 `plugin-runner` 的 `/health` 只有：

- `service`
- `status`
- `version`

这对安装诊断、平台诊断、运行态确认、同机/拆机判断都不够。继续往 `/health` 塞字段会让健康检查和运维诊断混成一个接口。

### 2.3 宿主尚无账号级语言闭环

当前仓库中：

- `UserRecord` 没有 `preferred_locale`
- `SessionRecord` 没有 locale
- `/api/console/me` 也没有语言字段

这意味着语言只能漂浮在浏览器 header 或前端本地缓存里，用户换设备后语言偏好不会跟着账号走。

### 2.4 后端与国际化边界仍不清晰

插件包自身已经有：

- `i18n/en_US.json`
- `i18n/zh_Hans.json`

但当前宿主 API 仍主要输出：

- `display_name`
- `description`
- `label`

这更像“后端已经决定了最终文案”，而不是“前端拿资源自己翻”。如果继续沿用这套思路，后端会逐渐承担越来越多本应由前端处理的国际化职责。

## 3. 本稿范围

本稿覆盖：

- `RuntimeTarget` 的正式多平台扩展
- `plugin CLI package` 的多平台二进制打包规则
- 官方 plugin release workflow 的多 runner 分工
- official registry 的轻量 i18n 摘要扩展
- 新增 `GET /api/console/system/runtime-profile`
- 新增 `GET /system/runtime-profile`（`plugin-runner` 内部接口）
- `api-server` 聚合 `plugin-runner` 运行时快照
- `host_fingerprint` 设计与同机/拆机判断
- 新权限点 `system_runtime.view.all`
- `preferred_locale` 写入用户资料闭环
- locale 解析优先级
- plugin / model-provider 相关接口统一 i18n contract

## 4. 非目标

本稿不在当前轮次解决：

- fat package 作为默认正式分发形态
- 完整的主机级重型监控平台
- 磁盘、网络、负载、进程树的全量细粒度监控
- 前端页面改造与最终 UI 展示
- runtime-generated 任意动态参数表单的完整 i18n 归一化
- 面向任意第三方 provider 的远端 marketplace 搜索与推荐体系

## 5. 核心结论

### 5.1 分发链继续坚持 thin package

默认正式分发继续采用：

- 一个逻辑插件版本
- 多个 target artifact

不会把 `Windows / Linux / macOS` 二进制一起打进默认 `.1flowbasepkg`。

### 5.2 首轮正式 target 扩到 6 个

正式支持矩阵扩为：

- `x86_64-unknown-linux-musl`
- `aarch64-unknown-linux-musl`
- `x86_64-apple-darwin`
- `aarch64-apple-darwin`
- `x86_64-pc-windows-msvc`
- `aarch64-pc-windows-msvc`

### 5.3 `runtime-profile` 独立成专用诊断接口

- `/health` 保持轻量健康检查
- `api-server` 暴露 `GET /api/console/system/runtime-profile`
- `plugin-runner` 暴露内部 `GET /system/runtime-profile`

### 5.4 同机识别采用 `host_fingerprint`

- 不直接暴露原始 MAC
- 对外只返回稳定、不可逆的宿主摘要值
- `api-server` 用它与 `plugin-runner` 快照做同机/拆机判断

### 5.5 账号级语言偏好补齐到 `UserRecord`

- 新增 `preferred_locale`
- 直接挂在现有 `/api/console/me` 读写里
- 语言优先级固定为：
  `query.locale > x-1flowbase-locale > user.preferred_locale > Accept-Language > en_US`

### 5.6 后端不负责最终翻译

后端在国际化上的职责只有：

- 解析 locale
- 校验 `preferred_locale`
- 读取插件包或 official registry 的 i18n 资源
- 把资源和 key 交给前端

后端不负责：

- 根据 locale 输出最终人类文案
- 维护前端 UI 文本翻译逻辑

## 6. 多平台打包与官方 release 链

### 6.1 RuntimeTarget 统一模型

`RuntimeTarget` 需要成为宿主、registry、CLI、workflow 的统一 target 真值模型。

它至少输出：

- `rust_target_triple`
- `os`
- `arch`
- `libc`
- `artifact_suffix`
- `executable_suffix`

约束如下：

- Linux:
  - `x86_64-unknown-linux-musl` => `linux / amd64 / musl / ""`
  - `aarch64-unknown-linux-musl` => `linux / arm64 / musl / ""`
- macOS:
  - `x86_64-apple-darwin` => `darwin / amd64 / none / ""`
  - `aarch64-apple-darwin` => `darwin / arm64 / none / ""`
- Windows:
  - `x86_64-pc-windows-msvc` => `windows / amd64 / msvc / ".exe"`
  - `aarch64-pc-windows-msvc` => `windows / arm64 / msvc / ".exe"`

宿主平台识别应优先输出与“官方产物选择”一致的 target，而不是仅输出 `std::env::consts::OS / ARCH`。

### 6.2 package CLI 规则

`scripts/node/plugin.js package` 仍是 host repo 中唯一正式 packager source of truth。

新增规则：

- `--target` 必须支持 6 个 target triple
- `--runtime-binary` 的目标文件名由 target 决定
- Windows 打包时，包内可执行文件必须写为 `bin/<provider>-provider.exe`
- 非 Windows 打包时，包内仍为 `bin/<provider>-provider`
- manifest 中的 `runtime.executable.path` 必须与包内真实文件名一致

### 6.3 official release workflow 规则

官方 release workflow 不再尝试单一 Ubuntu runner 交叉覆盖所有 target。

设计原则固定为：

- Linux target 在 Linux runner 上构建
- macOS target 在 macOS runner 上构建
- Windows target 在 Windows runner 上构建
- `Windows arm64` 与 `macOS arm64` 允许使用 hosted runner，但 workflow 不应假设所有 target 都能被同一 runner 稳定交叉构建

实现要求：

- workflow 必须按 target 矩阵拆 job 或 matrix 分组
- 每个 target 独立生成 `.1flowbasepkg`
- 每个 target 独立计算 checksum
- release 产物发布后统一汇总到同一个 registry entry 的 `artifacts[]`

### 6.4 official registry 扩展

official registry 继续保持：

- latest-only
- 每个 `provider_code` 只有一个逻辑最新版条目

但每个条目下的 `artifacts[]` 要覆盖 6 个 target。

同时新增轻量 i18n 摘要字段：

```json
{
  "plugin_id": "1flowbase.openai_compatible",
  "provider_code": "openai_compatible",
  "protocol": "openai_compatible",
  "latest_version": "0.2.1",
  "i18n_summary": {
    "default_locale": "en_US",
    "available_locales": ["en_US", "zh_Hans"],
    "bundles": {
      "en_US": {
        "plugin": {
          "label": "OpenAI-Compatible API Provider",
          "description": "Official 1flowbase provider plugin for services that expose an OpenAI-compatible chat completion API."
        },
        "provider": {
          "label": "OpenAI-Compatible API Provider"
        }
      },
      "zh_Hans": {
        "plugin": {
          "label": "OpenAI-Compatible API Provider",
          "description": "1flowbase 官方提供的 provider 插件，面向暴露 OpenAI 兼容 Chat Completions API 的服务。"
        },
        "provider": {
          "label": "OpenAI-Compatible API Provider"
        }
      }
    }
  }
}
```

这里的 `i18n_summary` 是“官方目录列表需要的轻量资源”，不是把插件包完整 `i18n/` 全量塞进 registry。

## 7. 宿主运行时画像与拓扑聚合

### 7.1 新增独立 runtime-profile 能力层

宿主需要新增一层独立运行时适配模块，负责：

- 平台识别
- host fingerprint 生成
- CPU / 内存 / uptime 快照
- 语言解析
- 统一 `RuntimeProfile` 序列化

这层不承载控制面业务逻辑，也不承载插件协议逻辑。

### 7.2 RuntimeProfile 输出内容

第一版只做轻量快照，不做重监控。

标准输出至少包含：

- `host_fingerprint`
- `platform.os`
- `platform.arch`
- `platform.libc`
- `platform.rust_target_triple`
- `platform.artifact_suffix`
- `platform.executable_suffix`
- `cpu.logical_count`
- `memory.total_bytes`
- `memory.available_bytes`
- `memory.process_bytes`
- `memory.total_gb`
- `memory.available_gb`
- `memory.process_gb`
- `uptime_seconds`
- `started_at`
- `captured_at`
- `service`
- `service_version`
- `service_status`

其中：

- `*_gb` 仅作为前端友好显示字段，保留两位小数
- `*_bytes` 继续作为精确诊断字段

### 7.3 host_fingerprint 规则

`host_fingerprint` 的目标是“稳定识别宿主是否为同一台机器”，不是暴露真实硬件地址。

生成优先级：

1. 优先读取系统稳定标识
   - Linux 类似 `machine-id`
   - 其他平台优先使用系统级 UUID 或等价稳定标识
2. 若系统稳定标识不可用，再回退到网卡稳定标识集合
3. 对原始输入做排序、归一化、哈希
4. 仅向外暴露最终 fingerprint

规则要求：

- API 不返回原始 MAC 地址
- API 不返回原始系统 UUID
- fingerprint 在同一宿主重启后应保持稳定
- 不承诺跨系统重装仍保持不变

### 7.4 plugin-runner 内部接口

`plugin-runner` 新增：

- `GET /system/runtime-profile`

它是内部诊断接口，不面向公网产品语义。

返回自身快照，不承担聚合。

### 7.5 api-server 聚合接口

`api-server` 新增：

- `GET /api/console/system/runtime-profile`

它是前端唯一消费入口。

返回结构应同时表达：

- locale 解析结果
- `api-server` 自己的快照
- `plugin-runner` 可达性与快照
- 聚合后的 host 拓扑关系

建议返回结构：

```json
{
  "locale_meta": {
    "requested_locale": "zh_Hans",
    "resolved_locale": "zh_Hans",
    "fallback_locale": "en_US",
    "supported_locales": ["en_US", "zh_Hans"],
    "source": "user_preferred_locale"
  },
  "topology": {
    "relationship": "same_host"
  },
  "services": {
    "api_server": {
      "reachable": true,
      "service": "api-server",
      "status": "ok",
      "version": "0.1.0",
      "host_fingerprint": "host_abc123"
    },
    "plugin_runner": {
      "reachable": true,
      "service": "plugin-runner",
      "status": "ok",
      "version": "0.1.0",
      "host_fingerprint": "host_abc123"
    }
  },
  "hosts": [
    {
      "host_fingerprint": "host_abc123",
      "platform": {
        "os": "darwin",
        "arch": "arm64",
        "libc": null,
        "rust_target_triple": "aarch64-apple-darwin",
        "artifact_suffix": "darwin-arm64",
        "executable_suffix": ""
      },
      "cpu": {
        "logical_count": 10
      },
      "memory": {
        "total_bytes": 17179869184,
        "available_bytes": 8589934592,
        "process_bytes": 201326592,
        "total_gb": 16.00,
        "available_gb": 8.00,
        "process_gb": 0.19
      },
      "services": ["api-server", "plugin-runner"]
    }
  ]
}
```

### 7.6 聚合判断规则

- `api-server` 与 `plugin-runner` 的 `host_fingerprint` 相同：
  - `topology.relationship = "same_host"`
  - `hosts[]` 里只保留一个 host
- fingerprint 不同：
  - `topology.relationship = "split_host"`
  - `hosts[]` 里返回两个 host
- `plugin-runner` 不可达：
  - `topology.relationship = "runner_unreachable"`
  - `hosts[]` 至少返回 `api-server` host
  - `services.plugin_runner.reachable = false`
  - 整个接口不因 runner 不可达而失败

## 8. 权限模型

新增权限资源：

- `system_runtime.view.all`

访问规则：

- root 不受限制
- 非 root 必须显式拥有 `system_runtime.view.all`
- 权限目录、角色权限接口和 `/api/console/me` 的权限列表都要体现该权限点

这个接口属于“设置 / 运维诊断”能力，而不是普通成员默认可见能力。

## 9. 账号语言闭环

### 9.1 UserRecord 新增 preferred_locale

`UserRecord` 新增：

- `preferred_locale: Option<String>`

支持值首轮固定为：

- `en_US`
- `zh_Hans`

无值时表示“不固定用户语言偏好”，继续按 header fallback。

### 9.2 /me 读写直接扩展

不新增独立偏好接口，直接扩展现有：

- `GET /api/console/me`
- `PATCH /api/console/me`

新增字段：

- `preferred_locale`

行为规则：

- `PATCH /me` 传入合法 locale => 更新
- `PATCH /me` 传入 `null` => 清空用户偏好
- 传入不支持的 locale => `400 unsupported_locale`

### 9.3 locale 解析优先级

最终优先级固定为：

1. `query.locale`
2. `x-1flowbase-locale`
3. `user.preferred_locale`
4. `Accept-Language`
5. `en_US`

`Accept-Language` 不需要完整实现任意区域映射，只需要把常见请求收敛到当前支持集合，例如：

- `zh-CN / zh-Hans / zh` => `zh_Hans`
- `en-US / en-GB / en` => `en_US`

## 10. 国际化边界与 API contract

### 10.1 后端职责边界

后端负责：

- 解析 locale
- 返回 locale 元信息
- 返回插件 i18n bundle
- 返回稳定 key / enum / code / number

后端不负责：

- 帮前端挑最终显示文案
- 在 API 层输出 locale-resolved 的中文或英文标题

### 10.2 i18n contract 原则

plugin / model-provider 相关 API 统一改为“资源 + key”的 contract。

统一返回：

- `locale_meta`
- `i18n_catalog`
- 业务条目里的 `namespace`
- 业务条目里的 `label_key / description_key`

统一不再依赖 API 直接返回人类显示文案作为主要消费模式。

### 10.3 i18n_catalog 结构

建议结构：

```json
{
  "locale_meta": {
    "requested_locale": "zh_Hans",
    "resolved_locale": "zh_Hans",
    "fallback_locale": "en_US",
    "supported_locales": ["en_US", "zh_Hans"]
  },
  "i18n_catalog": {
    "plugin.openai_compatible": {
      "zh_Hans": {
        "plugin": {
          "label": "OpenAI-Compatible API Provider",
          "description": "1flowbase 官方提供的 provider 插件，面向暴露 OpenAI 兼容 Chat Completions API 的服务。"
        },
        "provider": {
          "label": "OpenAI-Compatible API Provider"
        },
        "fields": {
          "base_url": {
            "label": "基础地址"
          }
        }
      },
      "en_US": {
        "plugin": {
          "label": "OpenAI-Compatible API Provider",
          "description": "Official 1flowbase provider plugin for services that expose an OpenAI-compatible chat completion API."
        },
        "provider": {
          "label": "OpenAI-Compatible API Provider"
        }
      }
    }
  }
}
```

规则：

- 每个 namespace 最多只返回 `resolved_locale + fallback_locale` 两份 bundle
- 不返回其他无关 locale，避免 payload 失控

### 10.4 namespace 与 key 规则

静态 plugin package 元数据采用稳定推导规则：

- namespace:
  - `plugin.<provider_code>`
- key:
  - 插件标题：`plugin.label`
  - 插件描述：`plugin.description`
  - provider 标题：`provider.label`
  - 配置字段标题：`fields.<field_key>.label`
  - 配置字段描述：`fields.<field_key>.description`
  - 配置字段 placeholder：`fields.<field_key>.placeholder`
  - 静态模型标题：`models.<model_id>.label`
  - 静态模型描述：`models.<model_id>.description`

这意味着前端可以完全基于：

- namespace
- key
- bundles

自己完成最终文案选择。

### 10.5 official catalog 的 i18n 来源

official catalog 不再只依赖 `display_name`。

来源规则：

- official release workflow 读取插件源码仓的 `i18n/*.json`
- 只抽取 lightweight summary
- 写入 registry 的 `i18n_summary`
- `api-server` 在 list official catalog 时，把 `i18n_summary` 转成统一 `i18n_catalog`

这样：

- 官方目录可国际化
- 已安装插件目录可国际化
- 前后两者使用同一前端消费方式

### 10.6 已安装插件与 model-provider 的 i18n 来源

已安装插件和 model-provider 相关接口从安装包目录直接读取：

- `manifest`
- `provider`
- `models`
- `i18n`

再由宿主转换成统一 API contract。

### 10.7 本轮覆盖范围

本轮 i18n contract 覆盖：

- `/api/console/plugins/catalog`
- `/api/console/plugins/families`
- `/api/console/plugins/official-catalog`
- `/api/console/model-providers/catalog`
- `/api/console/model-providers/options`
- `runtime-profile` 的 `locale_meta`

本轮不强行覆盖：

- runtime-generated 任意动态 `parameter_form`
- provider runtime 在调用结果中临时返回的自然语言文本

这些内容先保持 pass-through，后续如果需要再为 provider runtime contract 增加显式 i18n key 设计。

## 11. 契约重构原则

由于当前仍处于初始开发阶段，本轮不为“旧接口兼容”保留额外负担。

原则固定为：

- 可以直接重构 API contract
- 可以移除“后端直接返回最终显示文案”的主要消费模式
- 可以让前端改为基于 `namespace + key + i18n_catalog` 工作

但内部存储层若仍保留 `display_name` 快照用于：

- 审计
- 回放
- fallback

这是允许的；关键是外部 API 契约不再把它定义为唯一真值。

## 12. 安全与隐私

### 12.1 运行时画像

`runtime-profile` 不返回：

- 原始 MAC
- 原始 machine-id
- 原始系统 UUID

只返回脱敏后的 `host_fingerprint`。

### 12.2 权限与暴露面

- `/health` 仍可轻量暴露
- `/api/console/system/runtime-profile` 必须走登录态 + 权限点
- `plugin-runner` 的 `/system/runtime-profile` 仅作为内部接口

### 12.3 i18n 资源

本轮只暴露插件作者本就放在包内或 registry summary 内的结构化文本，不额外暴露宿主内部敏感配置。

## 13. 验收标准

本设计完成后，至少应满足以下结果：

1. host 可识别并选择 6 个正式 target 的 artifact
2. official release workflow 可为 6 个 target 产出 `.1flowbasepkg`
3. `api-server` 的 `runtime-profile` 能判断 `api-server` 与 `plugin-runner` 是否同机
4. `runtime-profile` 同时返回 `bytes + gb`
5. root 可直接访问 `runtime-profile`
6. 非 root 必须具备 `system_runtime.view.all`
7. 用户可通过 `/api/console/me` 读写 `preferred_locale`
8. locale 解析优先级严格遵守：
   `query > custom header > user preference > Accept-Language > en_US`
9. official catalog、installed plugin catalog、model-provider catalog 能统一返回 `i18n_catalog + key`
10. 前端在不依赖后端翻译的前提下，能够基于 API 返回资源自己完成中英文切换
