---
memory_type: tool
topic: verify-backend 会因 clippy::redundant_closure 在 runtime route 序列化映射阶段失败
summary: `node scripts/node/verify-backend.js` 运行到 Clippy 时，如果 Rust 代码仍保留 `value.map(|x| f(x))` 这类冗余闭包写法，会因 `clippy::redundant_closure` 直接失败；改成函数指针形式并重跑脚本即可恢复通过。
keywords:
  - node
  - verify-backend
  - clippy
  - redundant_closure
  - rust
match_when:
  - 执行 `node scripts/node/verify-backend.js`
  - 输出 `clippy::redundant_closure`
  - 失败点位于 Rust 的 `Option::map` 或迭代器映射闭包
created_at: 2026-04-17 18
updated_at: 2026-04-17 18
last_verified_at: 2026-04-17 18
decision_policy: reference_on_failure
scope:
  - node
  - scripts/node/verify-backend.js
  - api/apps/api-server/src/routes/application_runtime.rs
---

# verify-backend 会因 clippy::redundant_closure 在 runtime route 序列化映射阶段失败

## 时间

`2026-04-17 18`

## 为什么做这个操作

- 需要执行 `node scripts/node/verify-backend.js` 完成模块 05 runtime orchestration 的统一后端门禁。

## 失败现象

- 脚本在 Clippy 阶段报：

```text
error: redundant closure
help: replace the closure with the function itself
```

- 失败点指向 `api/apps/api-server/src/routes/application_runtime.rs` 的 `format_optional_time`。

## 触发条件

- 后端代码里存在 `value.map(|x| f(x))` 这类可以直接改为函数指针的闭包；
- 仓库当前把 Clippy warning 提升为失败；
- 直接运行统一后端门禁脚本。

## 根因

- 这不是逻辑回归，而是统一门禁里的 Clippy 静态检查命中 `clippy::redundant_closure`。
- `format_optional_time` 保留了 `value.map(|timestamp| format_time(timestamp))` 这种冗余写法。

## 解法

- 把冗余闭包直接改成函数指针形式：`value.map(format_time)`。
- 修复后重新运行 `node scripts/node/verify-backend.js`。

## 验证方式

- `2026-04-17 18` 已验证：将 `value.map(|timestamp| format_time(timestamp))` 改为 `value.map(format_time)` 后，`verify-backend.js` 全量通过。

## 后续避免建议

- 写 Rust 映射辅助函数时，优先检查 `map` / `and_then` / 迭代器闭包能否直接传函数指针，避免把这类门禁失败拖到统一验证阶段才发现。

## 复现记录

- `2026-04-17 18`：模块 05 Task 6 首次执行 `verify-backend.js` 时，`application_runtime.rs` 因 `clippy::redundant_closure` 失败；改成函数指针并重跑后通过。
