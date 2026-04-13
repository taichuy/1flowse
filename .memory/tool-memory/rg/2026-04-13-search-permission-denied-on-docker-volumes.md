---
memory_type: tool
topic: rg 扫描仓库根目录时可能在 docker 挂载卷目录触发 permission denied
summary: 在仓库根直接用 `rg` 扫 `docker/` 时，可能命中 `docker/volumes/postgres` 并报 `Permission denied (os error 13)`；排查时应先限制搜索根目录，或显式排除 `docker/volumes/**`。
keywords:
  - rg
  - permission denied
  - docker volumes
match_when:
  - 需要在仓库根目录用 rg 搜索 docker 相关文本
  - 输出出现 `docker/volumes/postgres: Permission denied (os error 13)`
created_at: 2026-04-13 08
updated_at: 2026-04-13 08
last_verified_at: 2026-04-13 08
decision_policy: reference_on_failure
scope:
  - rg
  - docker/volumes
  - docker/volumes/postgres
---

# rg 扫描仓库根目录时可能在 docker 挂载卷目录触发 permission denied

## 时间

`2026-04-13 08`

## 失败现象

执行仓库根目录搜索时，`rg` 输出：

```text
docker/volumes/postgres: Permission denied (os error 13)
```

## 触发条件

- 在仓库根目录直接对 `docker/` 或全仓执行 `rg`
- 搜索范围包含本地 Docker 挂载卷目录 `docker/volumes/postgres`

## 根因

- `docker/volumes/postgres` 是本地运行态数据目录，当前用户对其中部分文件没有读取权限。
- `rg` 进入该目录后会直接报权限错误，中断当前搜索结果判断。

## 解法

- 优先把 `rg` 搜索范围限制到明确源码目录，例如 `api README.md scripts docker/README.md`
- 或显式排除运行态目录，例如加 `-g '!docker/volumes/**'`

## 验证方式

- 复现：在仓库根执行包含 `docker/` 的广泛 `rg`
- 修复验证：改为限定目录或排除 `docker/volumes/**` 后，搜索不再出现权限错误

## 复现记录

- `2026-04-13 08`：排查 `dev-up` 启动问题时，执行 `rg -n "...\" api README.md docker scripts` 触发 `docker/volumes/postgres: Permission denied (os error 13)`；后续通过限制搜索范围规避。
