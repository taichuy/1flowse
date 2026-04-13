---
memory_type: tool
topic: 在 monorepo 根目录用 rg 前先确认真实 workspace/crate 路径
summary: 在本仓库根目录直接把路径写成 `packages`、`storage_pg` 这类想当然名字时，`rg` 会报 `No such file or directory`；已验证应先用 `find` 或 `rg --files` 确认真实目录名，例如 `web/packages`、`api/crates/storage-pg`。
keywords:
  - rg
  - monorepo
  - workspace
  - crate
  - no such file or directory
match_when:
  - 在仓库根目录检索 workspace 或 crate 代码
  - 准备把口头目录名直接写进 `rg` 路径参数
  - `rg` 输出 `No such file or directory`
created_at: 2026-04-14 07
updated_at: 2026-04-14 07
last_verified_at: 2026-04-14 07
decision_policy: reference_on_failure
scope:
  - rg
  - web/packages
  - api/crates
---

# 在 monorepo 根目录用 rg 前先确认真实 workspace/crate 路径

## 时间

`2026-04-14 07`

## 失败现象

在仓库根目录检索时，执行带显式路径参数的 `rg`：

- `rg -n "..." web packages -g '*.ts' -g '*.tsx'`
- `rg -n "..." api/crates api/apps storage_pg -g '*.rs'`

都会返回 `No such file or directory`，对应不存在的路径分别是：

- `packages`
- `storage_pg`

## 触发条件

- 需要从 monorepo 根目录同时搜多个 workspace/crate。
- 脑中记的是逻辑名字，而不是仓库里的真实相对路径。

## 根因

- 本仓库前端包实际在 `web/packages/*`，不是根级 `packages/*`。
- 后端 crate 实际在 `api/crates/storage-pg`，不是 `storage_pg`。

## 已验证解法

先确认真实路径，再带路径检索：

```bash
find web -maxdepth 2 -type d | sort
find api/crates -maxdepth 1 -type d | sort
```

然后再执行：

```bash
rg -n "AppRouteId" web/app web/packages -g '*.ts' -g '*.tsx'
rg -n "update_password_hash" api/apps api/crates api/crates/storage-pg -g '*.rs'
```

## 后续避免建议

- 在 monorepo 根目录检索前，不要假设顶层一定存在 `packages/` 或把 crate 名里的连字符改成下划线。
- 如果是第一次碰某个 workspace/crate，优先用 `find` 或 `rg --files` 验证路径，再写带目标目录的 `rg`。
