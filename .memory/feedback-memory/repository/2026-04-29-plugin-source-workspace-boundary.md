---
memory_type: feedback
feedback_category: repository
topic: plugin-source-workspace-boundary
summary: 主仓可以预留统一插件源码工作区，CLI 可在主仓生成插件；插件边界看独立打包安装加载，不按官方/外部源码位置区分。
keywords:
  - plugin-source
  - host-extension
  - cli
  - package
  - api/plugins
match_when:
  - 讨论插件源码放哪里、CLI 创建插件、host 插件目录、官方插件和外部插件目录时
created_at: 2026-04-29 07
updated_at: 2026-04-29 07
last_verified_at: 无
decision_policy: direct_reference
scope:
  - api/plugins
  - api/crates
  - api/apps/api-server
---

# 插件源码工作区边界

## 时间

`2026-04-29 07`

## 规则

不要按“官方插件 / 外部插件”分开设计主仓插件源码目录。主仓可以预留一个统一插件源码工作区，CLI 创建插件时可直接在这里生成插件源码。判断是否是插件，关键看它是否独立打包、安装、启停和加载，而不是源码是否位于主仓。

Host 插件源码不得放进 `api/crates` 或 `api/apps/api-server/src` 当核心静态依赖；应放在 `api/plugins` 下的插件源码工作区，通过 package/install/load 生命周期进入系统。

## 原因

用户明确纠正：插件可以独立打包，但开发时可以由 CLI 在主仓生成插件；不应该为了“外部插件”概念强制拆到另一个仓库，也不应该区分官方插件存放层级。

## 适用场景

- 设计 `api/plugins` 源码、包缓存、安装目录时。
- 设计插件 CLI scaffold 命令时。
- 更新 `api/AGENTS.md` 或插件目录约定时。

## 备注

主仓插件源码工作区与运行安装目录必须分离：源码用于开发和打包，`packages/` 是包产物，`installed/` 是安装结果。
