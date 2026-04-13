---
memory_type: tool
topic: 先列目录再读取辅助文档，避免假定 plan.md 存在
summary: 在仓库辅助脚本目录里直接用 `sed` 打开猜测的文档路径可能失败；已验证的做法是先用 `find` 或 `ls` 确认文件存在，再读取目标文件。
keywords:
  - bash
  - sed
  - missing-file
  - find
match_when:
  - 需要读取脚本目录里的辅助文档或说明文件
  - 使用 `sed` 打开猜测路径时报“没有那个文件或目录”
created_at: 2026-04-13 08
updated_at: 2026-04-13 08
last_verified_at: 2026-04-13 08
decision_policy: reference_on_failure
scope:
  - bash
  - scripts/node
  - sed
---

# 先列目录再读取辅助文档，避免假定 plan.md 存在

## 时间

`2026-04-13 08`

## 失败现象

执行 `sed -n '1,260p' scripts/node/mock-ui-sync/plan.md` 时返回“没有那个文件或目录”。

## 触发条件

在探索仓库内脚本工具目录时，主观假定会存在 `plan.md` 或同类说明文件，直接按猜测路径读取。

## 根因

该目录实际只有 `core.js` 和测试文件，没有额外说明文档；失败来自路径假设，而不是权限或编码问题。

## 解法

先用 `find <dir> -maxdepth 2 -type f` 或 `ls` 确认目录内容，再对确认存在的文件执行 `sed` / `cat`。

## 验证方式

先执行 `find scripts/node/mock-ui-sync -maxdepth 2 -type f`，确认真实存在的文件后，再读取 `scripts/node/mock-ui-sync/core.js` 成功。

## 复现记录

- `2026-04-13 08`：在 `scripts/node/mock-ui-sync` 目录假定存在 `plan.md` 失败，改为先列目录后已成功读取实际文件。
