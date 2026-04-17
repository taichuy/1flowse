---
memory_type: tool
topic: verify-backend 可能先被 rustfmt diff 拦截，导致拿不到后端行为证据
summary: 当运行 `node scripts/node/verify-backend.js` 时，如果输出以多个 `Diff in ...` 开头并立即退出，说明脚本先卡在 `rustfmt --check`，这时不能直接把失败解读成后端逻辑回归；已验证的补证据做法是按串行方式单独跑相关 `cargo test` 获取行为结论。
keywords:
  - verify-backend
  - rustfmt
  - cargo-test
  - formatting
  - runtime
match_when:
  - 运行 `node scripts/node/verify-backend.js` 后只看到 diff 样式输出
  - 需要判断后端逻辑是否真的失败，但统一验证脚本先被格式检查拦截
created_at: 2026-04-17 17
updated_at: 2026-04-17 17
last_verified_at: 2026-04-17 17
decision_policy: reference_on_failure
scope:
  - node scripts/node/verify-backend.js
  - api
  - cargo test
---

# verify-backend 可能先被 rustfmt diff 拦截，导致拿不到后端行为证据

## 时间

`2026-04-17 17`

## 失败现象

- 运行 `node scripts/node/verify-backend.js` 后，输出大量 `Diff in ...`，命令以非零状态退出。
- 脚本没有继续给出测试或运行时行为结果。

## 触发条件

- 当前分支存在 Rust 格式漂移，统一验证脚本先执行格式检查。

## 根因

- 统一后端验证脚本被 `rustfmt --check` 这类前置门禁拦住，行为测试没有真正开始。

## 已验证解法

- 不要直接把这类失败解释成后端逻辑回归。
- 先串行补跑和当前范围直接相关的测试拿行为证据，例如：
  - `cargo test -p control-plane`
  - `cargo test -p storage-pg flow_repository_tests`
  - `cargo test -p storage-pg application_repository_tests`
  - `cargo test -p api-server application_orchestration_routes`
  - `cargo test -p api-server application_routes`
- 拿到行为证据后，再决定是否执行格式归一化并重跑 `verify-backend`。
