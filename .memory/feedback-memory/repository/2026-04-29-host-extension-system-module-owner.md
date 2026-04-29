---
memory_type: feedback
feedback_category: repository
topic: host-extension-system-module-owner
summary: HostExtension 不是窄 bridge；它是受治理的内核级系统模块，可以拥有命名空间资源、migration、service 和受控 route。
keywords:
  - host-extension
  - system-module
  - migration
  - route
  - plugin-layering
match_when:
  - 讨论 HostExtension 能力边界、系统模块、插件分层、后端目录或新增功能落点时
created_at: 2026-04-29 07
updated_at: 2026-04-29 07
last_verified_at: 无
decision_policy: direct_reference
scope:
  - api
  - api/plugins
  - api/crates
---

# HostExtension 系统模块所有权

## 时间

`2026-04-29 07`

## 规则

不要把 `HostExtension` 收窄成只能做宿主 bridge 或 boot adapter。用户明确将它理解为内核级插件：它可以激活系统模块实现，可以拥有自己命名空间下的系统资源、migration、repository、service、worker 和通过 host route registry 注册的受控 route。

`HostExtension` 的限制是治理边界，而不是能力过窄：不能绕过 Boot Core 的安装、权限、审计、主存储连接、安全策略和插件生命周期表；不能裸开任意 HTTP route；不能直接改写其他模块拥有的表。

## 原因

Host 插件要承担可独立启停、可替换的系统模块实现。如果只允许它做 bridge，会无法覆盖文件管理、插件市场、数据源平台、工作流平台这类可模块化的系统能力。

## 适用场景

- 修改插件分层 spec 或 `api/AGENTS.md` 时。
- 判断新增系统功能写入 `Core` 还是 `HostExtension` 时。
- 讨论 HostExtension migration、系统表、API route、worker 注册时。

## 备注

核心判断：Boot Core 拥有全局治理资源；HostExtension 可以拥有 extension namespace 内的系统模块资源。
