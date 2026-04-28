# HostExtension Boundary 1+n Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 `HostExtension` 内核级插件边界从 spec 落到可逐步执行的工程计划。

**Architecture:** 采用 `1 个索引 + 5 个子计划`。先收敛术语和稳定契约，再新增 HostExtension manifest/registry 与启动期 lifecycle，随后把 `storage-durable / storage-ephemeral / storage-object / data_source / file_management` 纳入官方 host 能力面，最后改造现有 provider-centric 插件管理链路为 slot-aware。

**Tech Stack:** Rust 2021、Axum、SQLx/PostgreSQL、Serde、UUID v7、time、React 19、TypeScript、Vitest、Node plugin CLI

---

## Design Source

- [HostExtension 内核级插件边界设计](../specs/2026-04-28-host-extension-boundary-design.md)

## Child Plans

1. [Terminology and Contract Baseline](./2026-04-28-host-extension-boundary-01-terminology-contracts.md)
   固定 `Boot Core / HostExtension / RuntimeExtension / CapabilityPlugin`、host contract、runtime slot、storage implementation 的工程术语与边界测试。
2. [HostExtension Manifest and Registry](./2026-04-28-host-extension-boundary-02-manifest-registry.md)
   新增 HostExtension manifest v1、contract/slot/interface/storage registry、inventory domain。
3. [Boot Loader Policy Lifecycle](./2026-04-28-host-extension-boundary-03-boot-loader-policy-lifecycle.md)
   落启动期发现、依赖排序、deployment policy、override policy、health/safe mode。
4. [Official Host Modules Storage Data File](./2026-04-28-host-extension-boundary-04-official-host-modules.md)
   把 storage、data access、file management、model runtime 等官方 host 能力面注册为内置 HostExtension。
5. [Slot-Aware Plugin Management](./2026-04-28-host-extension-boundary-05-slot-aware-plugin-management.md)
   把现有 provider-centric 安装/启用/分配链路改造成 host-extension-aware 与 slot-aware。

## Required Execution Order

- [x] **Step 1: Execute Terminology and Contract Baseline**

Plan:

```text
docs/superpowers/plans/2026-04-28-host-extension-boundary-01-terminology-contracts.md
```

Why first:

1. 后续所有代码都依赖同一组 enum、常量、manifest 字段和 AGENTS 规则。
2. 先把 `provider` 从插件主类型降级为 `model_provider` runtime slot，避免继续扩大命名债。

- [x] **Step 2: Execute HostExtension Manifest and Registry**

Plan:

```text
docs/superpowers/plans/2026-04-28-host-extension-boundary-02-manifest-registry.md
```

Why second:

1. 没有 manifest 和 registry，Boot loader 只能硬编码官方模块。
2. inventory 是后续 deployment policy、health、UI 展示和 self-hosted override 的事实来源。

- [x] **Step 3: Execute Boot Loader Policy Lifecycle**

Plan:

```text
docs/superpowers/plans/2026-04-28-host-extension-boundary-03-boot-loader-policy-lifecycle.md
```

Why third:

1. HostExtension 是 boot-time 系统模块，不是普通 runtime enable。
2. 必须先有确定性加载顺序、override policy 和 failure policy，才能接官方 host modules。

- [x] **Step 4: Execute Official Host Modules Storage Data File**

Plan:

```text
docs/superpowers/plans/2026-04-28-host-extension-boundary-04-official-host-modules.md
```

Why fourth:

1. `storage-durable / storage-ephemeral / storage-object` 应由官方 `storage-host` 注册和管理。
2. data source、file management、model provider 都要从 hard-coded core 语义迁到 host capabilities。

- [ ] **Step 5: Execute Slot-Aware Plugin Management**

Plan:

```text
docs/superpowers/plans/2026-04-28-host-extension-boundary-05-slot-aware-plugin-management.md
```

Why last:

1. 现有安装链路仍以 provider package 为中心。
2. 只有前四步提供了 host slot registry 和官方 slot，安装/启用/分配才能按 slot-aware 方式改造。

## Coverage Matrix

| Spec Requirement | Plan |
| --- | --- |
| Boot Core 只负责可启动、可加载、可治理 | 01, 03 |
| HostExtension 是内核级 trusted host module | 01, 02, 03 |
| HostExtension 可以定义、替换、增强 host contract | 02, 03 |
| RuntimeExtension 只实现已注册 runtime slot | 01, 02, 05 |
| CapabilityPlugin 只贡献 workspace 用户能力 | 01, 05 |
| storage-durable / storage-ephemeral 保留命名 | 01, 04 |
| 不新增 Driver 层级 | 01, 04 |
| storage implementation 归入 HostExtension 管理 | 02, 04 |
| 文件管理是 file-management-host，不是 workspace 插件 | 04 |
| 数据源是 data-access-host 提供的 runtime slot | 04, 05 |
| NocoBase “一切皆插件”只迁移 host registry/lifecycle 思想 | 01, 03 |
| workspace 用户不能安装 HostExtension | 03, 05 |
| HostExtension boot-time 激活、失败 unhealthy/safe mode | 03 |
| provider 从插件主类型降级为 model_provider slot | 01, 05 |
| provider-centric 管理链路改 slot-aware | 05 |

## Global Verification

- [ ] **Step 1: Run backend focused tests**

Run:

```bash
cargo test -p plugin-framework -p control-plane -p storage-postgres
```

Expected:

```text
test result: ok
```

- [ ] **Step 2: Run route and contract tests when API routes change**

Run:

```bash
cargo test -p api-server plugin_routes
```

Expected:

```text
test result: ok
```

- [ ] **Step 3: Run frontend settings tests when UI changes**

Run:

```bash
pnpm --dir web/app vitest run src/features/settings
```

Expected:

```text
Test Files ... passed
```

## Completion Criteria

- [ ] `HostExtension` manifest and registry exist as first-class backend contracts.
- [ ] Boot-time host extension lifecycle is separate from runtime extension enable lifecycle.
- [ ] Official `storage-host` registers `storage-durable / storage-ephemeral / storage-object`.
- [ ] Official `data-access-host` registers `data_source`.
- [ ] Official `file-management-host` registers file management and `file_processor`.
- [ ] Existing provider install path no longer assumes every non-host plugin is a model provider.
- [ ] Documentation and AGENTS rules use `Boot Core / HostExtension / RuntimeExtension / CapabilityPlugin` consistently.
