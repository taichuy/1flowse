---
memory_type: tool
topic: chrome-devtools 遗留 browser profile 会阻塞 new_page，清理时不能宽匹配 pkill
summary: `chrome-devtools` 在已有 `chrome-profile` 实例残留时会报 browser already running，`new_page`/`list_pages` 都会失败。先用 `ps -ef` 查 `chrome-devtools-mcp` 与 `chrome-profile` 相关进程，再只清理遗留 browser/profile 进程可恢复。不要直接用 `pkill -f 'chrome-devtools-mcp'`，否则可能把当前执行 shell 一起打掉，命令返回 `-1`。
keywords:
  - chrome-devtools
  - chrome-profile
  - new_page
  - browser already running
  - pkill
match_when:
  - `chrome-devtools` 调 `new_page` 或 `list_pages` 报 browser already running
  - 需要恢复本地浏览器验收链路
  - 清理 devtools 遗留进程
created_at: 2026-04-14 03
updated_at: 2026-04-14 03
last_verified_at: 2026-04-14 03
decision_policy: reference_on_failure
scope:
  - chrome-devtools
  - bash
  - /home/taichu/.cache/chrome-devtools-mcp/chrome-profile
---

# chrome-devtools 遗留 browser profile 会阻塞 new_page，清理时不能宽匹配 pkill

## 时间

`2026-04-14 03`

## 失败现象

- `mcp__chrome-devtools__new_page`
- `mcp__chrome-devtools__list_pages`

会返回：

```text
The browser is already running for .../chrome-profile
Use --isolated to run multiple browser instances.
```

同时如果在 shell 里直接执行：

```bash
pkill -f 'chrome-devtools-mcp'
```

当前命令本身可能被一起杀掉，`exec_command` 直接返回 `-1`。

## 根因

1. `chrome-devtools-mcp` 之前的 browser/profile 进程没有被正确回收。
2. `pkill -f` 的模式过宽，会匹配当前执行命令行本身。

## 解法

1. 先执行：

```bash
ps -ef | rg '/home/taichu/.cache/chrome-devtools-mcp/chrome-profile|chrome-devtools-mcp'
```

2. 确认哪些是遗留 browser/profile 进程，优先清理这些精确目标，而不是直接宽匹配整个 `chrome-devtools-mcp`。
3. 浏览器进程清掉后，再重新调用 `new_page`。

## 验证方式

- `new_page` 能重新打开本地 URL
- 随后 `take_snapshot` / `click` 可正常工作

## 复现记录

- `2026-04-14 03`：`tmp/demo` 浏览器验收时命中 `browser already running for chrome-profile`；宽匹配 `pkill` 让当前 shell 直接异常退出。改为先 `ps` 定位遗留进程后，再重新打开页面，浏览器验收恢复正常。
