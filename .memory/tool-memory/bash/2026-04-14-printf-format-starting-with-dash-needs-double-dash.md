---
memory_type: tool
topic: bash printf 格式串以连字符开头时要显式加 --
summary: 在 shell 中调用 `printf` 时，如果格式串以 `-` 开头，某些实现会把它当成选项解析并报“无效的选项”；应改用 `printf -- '...'` 明确结束选项解析。
keywords:
  - bash
  - printf
  - dash
  - invalid option
match_when:
  - 在 shell 循环里用 `printf` 打印以 `---` 开头的分隔线
  - 输出出现 `printf: --: 无效的选项`
  - 需要在批量扫描文件时打印 markdown 风格分隔头
created_at: 2026-04-14 00
updated_at: 2026-04-17 15
last_verified_at: 2026-04-17 15
decision_policy: reference_on_failure
scope:
  - bash
  - shell
  - printf
---

# bash printf 格式串以连字符开头时要显式加 --

## 时间

`2026-04-14 00`

## 失败现象

执行批量扫描记忆文件的 shell 命令时，终端输出：

- `printf: --: 无效的选项`

但目标只是想打印 `--- file ---` 这样的分隔头。

## 为什么做这个操作

需要在一轮内批量查看多个记忆文件的 front matter，并在每个文件输出前打印清晰的分隔头，便于快速扫读。

## 触发条件

- 在 `bash` 中直接执行 `printf '--- %s ---\n' "$file"`
- 格式串本身以连字符开头

## 根因

某些 `printf` 实现会先解析选项；当格式串从 `---` 开始时，会被误判为选项输入。

## 解法

- 改用 `printf -- '--- %s ---\n' "$file"`，显式结束选项解析
- 或改成 `echo`，但需要接受转义与跨 shell 行为差异

## 验证方式

- 加上 `--` 后，分隔头正常输出
- 后续文件内容扫描不再出现 `printf` 选项报错

## 复现记录

- `2026-04-14 00`：在批量读取 `.memory` 目录的 YAML front matter 时，使用 `printf '--- %s ---\n' "$f"` 打印分隔头，触发 `printf: --: 无效的选项`；改为 `printf -- '--- %s ---\n' "$f"` 可避免同类报错。
- `2026-04-17 15`：在扫描 `.memory/project-memory` 和 `.memory/tool-memory` front matter 时，再次用 `printf '--- %s ---\n' '{}'` 打印文件头，命中同样的 `printf: --: 无效的选项`；后续这类批量扫描命令固定改成 `printf -- ...` 或直接避免用 `printf` 输出 `---` 起始格式串。
