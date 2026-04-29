---
memory_type: project
title: Host extension plugin packaging boundary
created_at: 2026-04-29 07
updated_at: 2026-04-29 09
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

用户明确指出：如果扩展仍然围绕在核心代码中编译和链接，那只是封装，不是插件。插件必须可以独立打包和加载。插件源码可以由 CLI 在主仓专门插件目录生成和维护，但必须通过 package/install/load 生命周期进入系统，不能作为 `api/crates` 或 `api-server` 静态依赖直接编进核心。

## 为什么要做？

后续后端目录与约定需要避免把 host 插件实现放进 `api/crates` 并链接进核心宿主，从而把插件边界退化成内部模块边界。主仓可以预留统一插件源码工作区，不区分官方插件存放；插件是否成立看独立打包、安装、启停和加载生命周期。

## 截止日期？

当前后端插件大调整阶段即时生效。2026-04-29 09 用户确认：`插件分层与 HostExtension 收敛设计` 不只是草案，将作为下一步开发调整目标，需要按即将落地的目标架构严格审计。

## 决策背后动机？

`HostExtension` 应按主应用进程内加载的插件生命周期设计，不是单独启动子进程。用户可以把打包插件放到指定目录，通过命令或管理界面开启、关闭或管理；host extension 的启停变更需要重启系统后生效。核心宿主只负责协议、扫描、策略、状态、加载与 inventory；插件源码可以在主仓专门插件目录内开发，但运行时必须从独立包或安装目录加载。

不要把 Rust `so/dll` native 动态库设计成可重复热加载 / 热卸载的 HostExtension 机制。Rust 依赖链中的 TLS、`static`、allocator 与全局状态很难可靠回收，反复 unload/reload 容易引入不可控泄漏和不稳定性。若需要可重复加载卸载的扩展运行时，优先考虑 WASM 或 Lua/mlua 一类可控沙箱；native host extension 最多按进程生命周期加载，禁用/升级通过 desired state + 重启生效。

2026-04-29 07 进一步修正：`HostExtension` 不应被收窄成只能做 bridge / boot adapter。它是受治理的内核级系统模块，可以拥有 extension namespace 下的系统表、migration、repository、service、worker 和受控 route。Boot Core 仍拥有安装、权限、审计、主存储连接、安全策略和插件生命周期表等全局治理资源。

2026-04-29 07 继续修正：后端需要补 `Resource Action Kernel` 作为 HostExtension 扩展核心业务的稳定面。`Resource` 不是数据库表，`Action` 是可治理动作入口，`Hook` 是显式横向扩展点。HostExtension 可以对现有核心业务注册 action hook、policy、validator、sidecar table、受控 action、worker 和 domain event，但不能直接改核心资源真值表、隐式包裹 service 或绕过 repository 边界。

2026-04-29 07 缓存与分布式基础设施补充：当前单机阶段可以保留 in-memory / local / PostgreSQL lease 默认实现，但未来 Redis 等分布式能力应作为 HostExtension 实现 Core 定义的 `storage-ephemeral`、`cache-store`、`distributed-lock`、`event-bus`、`task-queue`、`rate-limit-store` contract。Core 拥有缓存语义、失效规则、任务 claim、事件投递和限流窗口；HostExtension 只负责实现；RuntimeExtension 与 CapabilityPlugin 不能直接持有 Redis 等基础设施连接。

2026-04-29 09 用户进一步拍板：下一步按完整目标架构落地，不保留 Core 内置 Redis 过渡目标；`task-queue` 默认语义采用 at-least-once + idempotency key + visibility timeout；domain event 走 durable outbox，纯 runtime live event 可非持久；持久化到数据库的 `catalog snapshot / read model` 归持久化层实现，不归 `cache-store`；HostExtension 第一阶段先做 native in-process，只面向可信官方插件和部署级插件，第三方多运行时后置。
