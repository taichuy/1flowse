---
memory_type: tool
topic: cargo fmt 传入文件路径时按当前工作目录解析
summary: 在仓库根执行 `cargo fmt --manifest-path api/Cargo.toml --all -- apps/...` 会报文件不存在，因为 rustfmt 的文件参数按当前工作目录解析；切到 `api/` 目录重跑或显式带上 `api/` 前缀即可。
keywords:
  - cargo
  - fmt
  - rustfmt
  - manifest-path
  - cwd
  - file-not-found
match_when:
  - 使用 `cargo fmt --manifest-path ... -- <files>`
  - 文件路径按 crate/workspace 根写但命令在仓库根执行
  - 输出 `file ... does not exist`
created_at: 2026-04-13 16
updated_at: 2026-04-13 16
last_verified_at: 2026-04-13 16
decision_policy: reference_on_failure
scope:
  - cargo
  - rustfmt
  - api
---

# cargo fmt 传入文件路径时按当前工作目录解析

## 时间

`2026-04-13 16`

## 失败现象

执行：

```bash
cargo fmt --manifest-path api/Cargo.toml --all -- apps/api-server/src/_tests/openapi_alignment.rs ...
```

时，`cargo fmt` 连续报：

```text
Error: file `apps/...` does not exist
```

## 触发条件

- 在仓库根执行 `cargo fmt --manifest-path api/Cargo.toml --all -- <files>`；
- `<files>` 使用了相对 `api/` workspace 根的路径，而不是相对当前工作目录的路径。

## 根因

`--manifest-path` 只决定 Cargo 读取哪个 manifest，不会改变 rustfmt 解析文件参数时使用的当前工作目录；因此 `apps/...` 会被当成仓库根下的相对路径。

## 解法

- 切到 `api/` 目录后再执行同样的 `cargo fmt --all -- <files>`；
- 或者在仓库根执行时，把文件参数写成 `api/apps/...` 这种相对当前工作目录的路径。

## 验证方式

- 在仓库根执行带 `apps/...` 的命令，复现 `file does not exist`；
- 切到 `api/` 目录执行：

```bash
cargo fmt --all -- apps/api-server/src/_tests/openapi_alignment.rs ...
```

命令成功，目标文件完成格式化。

## 复现记录

- `2026-04-13 16`：为修复 `node scripts/node/verify-backend.js` 暴露的 rustfmt diff，先在仓库根用 `--manifest-path api/Cargo.toml` 跑定向 `cargo fmt`，结果全部报路径不存在；切到 `api/` 目录后重跑同样的相对路径命令成功。
