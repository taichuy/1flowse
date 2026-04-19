---
memory_type: project
topic: Rust provider runtime distribution 执行完成
summary: 自 `2026-04-19 23` 起，`docs/superpowers/plans/2026-04-19-rust-provider-plugin-runtime-distribution.md` 的六个任务已全部执行完成。主仓库已完成 schema v2 executable package、`plugin-runner` `stdio-json`、artifact-aware official registry、host CLI Rust-first packaging；sibling repo `../1flowbase-official-plugins` 已完成 multi-artifact release automation 与 `openai_compatible` Rust 迁移。六条跨仓库 focused verification 已全部通过。
keywords:
  - rust-provider
  - runtime-distribution
  - execution-complete
  - plugin-runner
  - official-registry
  - openai_compatible
match_when:
  - 需要确认 Rust provider runtime distribution 是否已执行完成
  - 需要继续在 schema v2 executable package / stdio-json runner / artifact registry 基础上迭代
  - 需要复用本轮 host commit、sibling repo commit 或 focused verification 结果
created_at: 2026-04-19 23
updated_at: 2026-04-19 23
last_verified_at: 2026-04-19 23
decision_policy: verify_before_decision
scope:
  - docs/superpowers/plans/2026-04-19-rust-provider-plugin-runtime-distribution.md
  - .memory/project-memory/2026-04-19-rust-provider-runtime-distribution-plan-stage.md
  - api/crates/plugin-framework
  - api/apps/plugin-runner
  - api/apps/api-server/src/official_plugin_registry.rs
  - scripts/node/plugin/core.js
  - ../1flowbase-official-plugins
---

# Rust provider runtime distribution 执行完成

## 完成状态

- 主仓库 `1flowbase` 已完成四次实现提交：
  - `feat: add executable provider package schema`
  - `feat: run provider binaries over stdio json`
  - `feat: select official plugin artifacts by host target`
  - `feat: package rust provider binaries per target`
- sibling repo `../1flowbase-official-plugins` 已完成两次实现提交：
  - `chore: publish multi-target official provider assets`
  - `feat: migrate openai_compatible provider to rust`
- 计划文档 `docs/superpowers/plans/2026-04-19-rust-provider-plugin-runtime-distribution.md` 六个任务与全部 step checkbox 均已勾完。

## 关键结果

- provider package contract 已切到 `schema_version: 2` + `runtime.kind=executable` + `runtime.protocol=stdio-json`。
- `plugin-runner` 不再通过 `node -e` bridge 执行 provider，而是直接拉起 package 内 `bin/*` 可执行文件并通过 `stdio-json` 交换请求/响应。
- 官方 registry 在 host 侧已改为读取 `artifacts[]`，并按当前宿主 target 只暴露一个选中的 artifact 给控制面。
- host `plugin CLI` 已改为生成 Rust scaffold，并要求 `package --runtime-binary --target` 产出 target-aware `.1flowbasepkg`。
- sibling repo release workflow 已改为 latest-only logical entry + multi-artifact release asset 生成。
- `openai_compatible` 已迁到 Rust crate，旧 `provider/openai_compatible.js` 已删除。

## 关键验证

- 以下 focused verification 已全部通过：
  - `rtk cargo test --manifest-path ../1flowbase-official-plugins/models/openai_compatible/Cargo.toml -- --nocapture`
  - `rtk cargo test --manifest-path api/Cargo.toml -p plugin-framework provider_package -- --nocapture`
  - `rtk cargo test --manifest-path api/Cargo.toml -p plugin-runner provider_runtime_routes -- --nocapture`
  - `rtk cargo test --manifest-path api/Cargo.toml -p api-server official_plugin_registry -- --nocapture`
  - `rtk node --test scripts/node/plugin/_tests/core.test.js`
  - `rtk node --test scripts/_tests/*.test.mjs`（在 `../1flowbase-official-plugins`）
- `Task 3` 执行时暴露出 `control-plane/src/plugin_management.rs` 对旧 manifest 字段的编译依赖，已在主仓库内同步切到 `provider.display_name` 与 `manifest.capabilities.model_types`。

## 后续迭代入口

- 若继续推进真实官方发布，可在 sibling repo bump `openai_compatible` 版本并触发新的 multi-artifact release。
- 若后续新增 Rust provider，优先复用当前 schema v2 manifest、`scripts/node/plugin.js package --runtime-binary --target`、以及 `provider-release.yml` 的 multi-target packaging 流程。
