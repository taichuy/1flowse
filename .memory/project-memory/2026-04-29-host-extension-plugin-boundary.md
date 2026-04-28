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

用户明确指出：如果扩展仍然围绕在核心代码中编译和链接，那只是封装，不是插件。插件必须可以独立打包和加载；只要源码和长期维护位置仍放在核心代码仓库内，就应按核心插件 / core extension 处理，不能伪装成外部插件。

## 为什么要做？

后续后端目录与约定需要避免把外部 host 插件实现长期放进核心仓库并链接进核心宿主，从而把插件边界退化成内部模块边界。放在核心仓库内的 host extension 可以存在，但要明确命名为核心插件 / core extension。

## 截止日期？

当前后端插件大调整阶段即时生效。

## 决策背后动机？

`HostExtension` 应按主应用进程内加载的插件生命周期设计，不是单独启动子进程。用户可以把打包插件放到指定目录，通过命令或管理界面开启、关闭或管理；host extension 的启停变更需要重启系统后生效。核心宿主只负责协议、扫描、策略、状态、加载与 inventory；真正外部扩展的源码、包构建与发布不应长期放在核心仓库内。

不要把 Rust `so/dll` native 动态库设计成可重复热加载 / 热卸载的 HostExtension 机制。Rust 依赖链中的 TLS、`static`、allocator 与全局状态很难可靠回收，反复 unload/reload 容易引入不可控泄漏和不稳定性。若需要可重复加载卸载的扩展运行时，优先考虑 WASM 或 Lua/mlua 一类可控沙箱；native host extension 最多按进程生命周期加载，禁用/升级通过 desired state + 重启生效。
