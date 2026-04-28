---
memory_type: project
title: Host extension plugin packaging boundary
created_at: 2026-04-29 07
updated_at: 2026-04-29 07
decision_policy: verify_before_decision
scope:
  - api
  - plugins
  - host-extension
status: active
---

# Host extension plugin packaging boundary

## 谁在做什么？

用户正在收敛后端插件体系，特别是 `HostExtension` 与核心代码封装的边界。

## 为什么这样做？

用户明确指出：如果扩展仍然围绕在核心代码中编译和链接，那只是封装，不是插件。插件必须可以独立打包和加载。

## 为什么要做？

后续后端目录与约定需要避免把官方 host 模块实现长期放进 `api/crates` 并链接进核心宿主，从而把插件边界退化成内部模块边界。

## 截止日期？

当前后端插件大调整阶段即时生效。

## 决策背后动机？

`HostExtension` 应按插件生命周期设计：用户可以把打包插件放到指定目录，通过命令或管理界面开启、关闭或管理；host extension 的启停变更需要重启系统后生效。核心宿主只负责协议、扫描、策略、状态、加载与 inventory，不应把可独立扩展的 host extension 实现当作普通内置 crate 长期维护。
