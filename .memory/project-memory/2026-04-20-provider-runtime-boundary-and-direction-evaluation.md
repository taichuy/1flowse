---
memory_type: project
topic: provider runtime 当前边界与方向评估
summary: 用户于 `2026-04-20 00` 询问 `1flowbase` 在 Rust native、Wasm、Lua 之间的运行时方向。当前代码已验证 official/provider 插件运行时边界是 `.1flowbasepkg` + 预编译 `executable` + `plugin-runner` 通过 `stdio-json` 拉起独立子进程调用，而不是进程内 `so/dll` 热加载/热卸载。因此 Rust TLS/static 在可重复 unload 场景下的风险判断成立，但不直接适用于当前实现；后续方向评估应明确把 Rust 动态库插件模式排除在主路线之外，优先沿现有 native executable 模式推进，Wasm 仅作为第二运行时候选，Lua 仅作为宿主脚本层候选。
keywords:
  - provider-runtime
  - executable
  - stdio-json
  - plugin-runner
  - wasm
  - lua
  - dylib
match_when:
  - 需要继续讨论 provider 插件运行时路线
  - 需要判断 Rust native、Wasm、Lua 哪个更适合当前插件体系
  - 需要解释 Rust TLS/static unload 风险是否适用于当前实现
  - 需要回看 plugin-runner 与 provider package 的边界
created_at: 2026-04-20 00
updated_at: 2026-04-20 00
last_verified_at: 2026-04-20 00
decision_policy: verify_before_decision
scope:
  - api/crates/plugin-framework/src/provider_package.rs
  - api/apps/plugin-runner/src/stdio_runtime.rs
  - api/apps/plugin-runner/src/provider_host.rs
  - api/apps/plugin-runner/src/package_loader.rs
  - scripts/node/plugin/core.js
---

# provider runtime 当前边界与方向评估

## 时间

`2026-04-20 00`

## 谁在做什么

- 用户在评估 `1flowbase` 官方 provider 插件后续应继续走 Rust native，还是切到 Wasm / Lua。
- AI 已基于当前仓库代码确认 runtime 真实边界，并给出风险收益分析输入。

## 为什么这样做

- 社区里关于 Rust 插件的很多经验，默认讨论的是进程内 `so/dll` 动态库反复 load / unload。
- 当前 `1flowbase` 实现并不是这条路，如果不先把边界讲清楚，会把不适用的风险混进当前决策。

## 为什么要做

- 为后续 provider 官方生态、打包发布和运行时治理建立清晰基线。
- 避免把 `plugin-runner` 重构成更复杂的新运行时，却没有得到明确收益。

## 截止日期

- 无

## 当前评估结论

- `provider package` manifest 当前只接受 `runtime.kind = executable` 与 `runtime.protocol = stdio-json`。
- `plugin-runner` 调用 provider runtime 的方式是 `Command::new(...)` 拉起独立子进程，写入 stdin，请求结束后等待退出。
- 加载对象是已安装或已解包 artifact，不是源码树，也不是宿主进程内动态库。
- 因此 Rust TLS/static 在“可重复卸载共享库”里的内存泄露和析构问题，不是当前架构的主要风险。
- 如果后续真的要支持进程内热插拔插件，应明确把 Rust `dylib/so/dll` 方案排除出主线。
- 若后续要追求更强沙箱或多语言生态，Wasm 可评估为第二运行时；Lua 更适合作为宿主脚本层，而不是官方 provider runtime 主线。
