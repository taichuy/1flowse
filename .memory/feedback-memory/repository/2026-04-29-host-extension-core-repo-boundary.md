---
memory_type: feedback
feedback_category: repository
topic: host-extension-core-repo-boundary
summary: HostExtension 是否是插件不能只看 manifest/package；源码在核心仓库内就应按核心插件处理，HostExtension 随主进程内加载而非子进程。
keywords:
  - host-extension
  - plugin-boundary
  - core-plugin
  - in-process
match_when:
  - 讨论后端插件目录、HostExtension、官方插件、核心插件或外部插件边界时
created_at: 2026-04-29 07
updated_at: 2026-04-29 07
last_verified_at: 无
decision_policy: direct_reference
scope:
  - api
  - api/plugins
  - api/crates
---

# HostExtension 核心仓库边界

## 时间

`2026-04-29 07`

## 规则

判断 HostExtension 是否是真插件，不能只看它是否有 manifest、package 或安装目录。只要源码和长期维护位置仍放在核心代码仓库内，就应明确称为核心插件 / core extension；不要把它描述成外部插件。HostExtension 随主应用进程内加载，启停变更通过 desired state 管理并在重启后生效，不应默认设计成单独子进程。

## 原因

用户指出：插件的关键是独立打包和加载；如果仍围绕核心代码维护，那只是核心封装或核心插件。Host 插件也是主进程能力扩展，不是 runtime extension 那种独立 runner 子进程。

## 适用场景

- 设计 `api/crates`、`api/plugins`、host extension package、drop-in 目录时。
- 更新 `api/AGENTS.md`、插件规范、后端目录约定时。
- 区分 core extension、official external plugin、third-party plugin、runtime extension 时。

## 备注

核心仓库可保留测试 fixture、模板或核心插件定义，但应在命名和文档中明确其核心属性；真正外部插件的源码、构建和发布边界应脱离核心仓库。
