---
memory_type: tool
topic: rg 正则里不能直接放带真实换行的字面量字符串
summary: 在 shell 中执行包含真实换行的 `rg -n` 模式时，会报 `the literal \"\\\"\\n\\\" is not allowed in a regex`；要么拆成简单模式，要么改用 `-U` 多行模式，或先用 `sed/nl` 读取定位。
keywords:
  - rg
  - regex
  - newline
  - multiline
  - shell
match_when:
  - 准备在 `rg` 模式里匹配跨行内容
  - `rg` 报 `the literal \"\\\"\\n\\\" is not allowed in a regex`
created_at: 2026-04-14 08
updated_at: 2026-04-14 08
last_verified_at: 2026-04-14 08
decision_policy: reference_on_failure
scope:
  - rg
  - shell
---

# rg 正则里不能直接放带真实换行的字面量字符串

## 时间

`2026-04-14 08`

## 失败现象

- 执行 `rg -n` 时，模式里直接带了真实换行，命令报：
- `the literal '"\n"' is not allowed in a regex`

## 触发条件

- 想直接用单条 `rg` 同时匹配多行 JS 代码片段或换行分隔的文本。

## 根因

- `rg` 默认不是按这种字面量换行模式解释正则；把真实换行直接塞进模式会触发语法错误。

## 解法

- 优先把问题拆成单行模式搜索。
- 如果确实需要跨行匹配，显式使用 `rg -U`。
- 如果只是为了快速确认代码片段位置，直接改用 `sed -n`、`nl -ba` 读取目标区间，通常更稳。

## 验证方式

- 出错后改用 `nl -ba scripts/node/dev-up/core.js | sed -n '220,320p'` 成功拿到所需代码上下文。

## 复现记录

- `2026-04-14 08`：为了确认 `scripts/node/dev-up/core.js` 的 env 解析逻辑，尝试用包含换行的 `rg` 模式直接搜实现，触发语法错误；随后改用 `nl + sed` 成功定位。
