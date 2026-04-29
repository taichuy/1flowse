---
memory_type: feedback
feedback_category: repository
topic: host-extension-no-rust-native-hot-unload
summary: 不要为 HostExtension 推荐 Rust so/dll 可重复热加载热卸载；可重复卸载应优先 WASM 或 Lua/mlua。
keywords:
  - host-extension
  - rust
  - dll
  - so
  - wasm
  - lua
  - mlua
  - hot-unload
match_when:
  - 讨论 HostExtension 运行时、native plugin、动态库加载、插件启停或插件生命周期时
created_at: 2026-04-29 07
updated_at: 2026-04-29 09
last_verified_at: 无
decision_policy: direct_reference
scope:
  - api
  - plugins
  - host-extension
---

# HostExtension 不做 Rust native 热卸载

## 时间

`2026-04-29 07`

## 规则

不要建议用 Rust `so/dll` 做可重复加载 / 卸载的 HostExtension 插件机制。HostExtension 如果走 native in-process，只能按主应用进程生命周期加载；启用、禁用、升级通过 desired state 管理，并在重启后生效。需要真正可重复卸载的扩展运行时，应优先考虑 WASM 或 Lua/mlua。

2026-04-29 09 用户拍板：第一阶段先做 native in-process HostExtension，只面向可信官方插件和部署级插件；第三方可重复加载 / 卸载运行时后续再考虑，项目前期不维护多套 HostExtension runtime。

## 原因

用户指出 Rust native 动态库反复卸载会被 TLS、`static` 变量、依赖链全局状态、allocator 等问题反复击穿；即使业务代码手动清理，依赖或间接依赖也可能引入无法稳定回收的状态。Hook allocator 或 patch Rust std 都属于高维护、高不稳定方案。

## 适用场景

- 设计 HostExtension 生命周期、loader、enable/disable 语义时。
- 讨论 `native_host`、`in_process`、`so/dll`、WASM、Lua/mlua 运行时选择时。
- 更新 `api/AGENTS.md` 或插件架构文档时。

## 备注

RuntimeExtension / CapabilityPlugin 的进程模型可另行设计；本规则主要约束随主应用进程内加载的 HostExtension。
