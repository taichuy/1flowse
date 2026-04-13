---
memory_type: tool
topic: rg 检索前端目录前先确认用户口头简称对应的真实路径
summary: 当用户口头提到 `tmp/mock` 这类简称时，直接执行 `rg --files tmp/mock web` 可能因为真实目录其实是 `tmp/mock-ui` 而报 `No such file or directory`；先用 `find tmp -maxdepth 2 -type d` 或 `rg --files tmp` 确认真实目录名，再做定向比较更稳。
keywords:
  - rg
  - no such file or directory
  - tmp/mock
  - tmp/mock-ui
  - path mismatch
match_when:
  - 用户用简称描述仓库内目录
  - 需要比较 `tmp` 下多个前端目录与正式目录
  - `rg --files` 输出 `No such file or directory`
created_at: 2026-04-13 10
updated_at: 2026-04-13 10
last_verified_at: 2026-04-13 10
decision_policy: reference_on_failure
scope:
  - rg
  - tmp
  - web
---

# rg 检索前端目录前先确认用户口头简称对应的真实路径

## 时间

`2026-04-13 10`

## 失败现象

执行 `rg --files tmp/mock web` 时，命令输出：

`tmp/mock: No such file or directory (os error 2)`

## 触发条件

用户口头说的是 `tmp/mock`，但仓库真实目录名是 `tmp/mock-ui`，直接按简称当作路径参数传给 `rg`。

## 根因

把用户表达里的简写目录当成了仓库里的精确路径，没有先做最小目录确认。

## 已验证解法

先执行 `find tmp -maxdepth 2 -type d` 或 `rg --files tmp` 确认真实目录名，再继续对目标目录执行 `rg --files`、`diff` 或其它定向比较命令。
