---
memory_type: feedback
feedback_category: repository
topic: resource-action-kernel-host-extension
summary: HostExtension 扩展核心业务应通过 Resource / Action / Hook 内核，而不是直接改核心表或隐式包裹 service。
keywords:
  - resource-action-kernel
  - host-extension
  - action-hook
  - resource
  - aop
match_when:
  - 讨论 HostExtension 如何扩展现有核心业务、resource/action 架构、AOP/AOC 横向扩展或后端插件稳定性时
created_at: 2026-04-29 07
updated_at: 2026-04-29 07
last_verified_at: 无
decision_policy: direct_reference
scope:
  - api
  - api/crates/control-plane
  - api/crates/plugin-framework
  - api/plugins
---

# Resource Action Kernel 与 HostExtension 横向扩展

## 时间

`2026-04-29 07`

## 规则

HostExtension 要支持类似 AOP/AOC 的横向扩展能力，但不能用隐式 monkey patch、直接包裹 service 或直接改核心表实现。稳定架构应补 `Resource Action Kernel`：`Resource` 是可治理业务资源，`Action` 是稳定动作入口，`Hook` 是显式扩展点。

HostExtension 扩展现有核心业务时，应通过 owned resource、contributed action、action hook、policy、validator、sidecar table、controlled route、worker、domain event 等声明式 contribution 进入宿主。

## 原因

用户希望架构具备类似 NocoBase 的 resource/action 可扩展性，但仍保留 1flowbase 的信任分层、状态一致性和插件隔离。直接开放表或 repository 会破坏权限、审计、事务和状态入口。

## 适用场景

- 设计 `control-plane` resource kernel。
- 扩展 `HostExtension` manifest。
- 判断 HostExtension 是否能扩展文件、工作流、插件安装、数据源、身份等核心业务。
- 讨论 action hook、sidecar table、domain event 或受控 route。

## 备注

核心判断：要改变核心资源真值，调用 Core action；要做横向策略，注册 action hook / policy；要保存扩展状态，写 extension-owned sidecar table。
