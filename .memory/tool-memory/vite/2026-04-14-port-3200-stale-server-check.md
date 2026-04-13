---
memory_type: tool
topic: 使用 3200 端口做 demo 浏览器验收前需要先确认是否已有陈旧 vite 进程
summary: 在 `tmp/demo` 做浏览器验收时，提权启动 `vite preview` 可能先报 `Port 3200 is already in use`，而现有占用进程随后又可能退出导致 `ERR_CONNECTION_REFUSED`；先用 `lsof -iTCP:3200 -sTCP:LISTEN -n -P` 确认占用进程，再决定复用还是重启自己的 server 更稳。
keywords:
  - vite
  - port 3200
  - stale server
  - connection refused
  - lsof
match_when:
  - 需要在 `tmp/demo` 用浏览器检查 `http://127.0.0.1:3200`
  - `vite preview` 报 `Port 3200 is already in use`
  - Playwright 或浏览器命中 `ERR_CONNECTION_REFUSED`
created_at: 2026-04-14 01
updated_at: 2026-04-14 01
last_verified_at: 2026-04-14 01
decision_policy: reference_on_failure
scope:
  - vite
  - tmp/demo
  - 3200
---

# 使用 3200 端口做 demo 浏览器验收前需要先确认是否已有陈旧 vite 进程

## 时间

`2026-04-14 01`

## 失败现象

先执行：

```bash
pnpm --dir tmp/demo/app exec vite preview --host 127.0.0.1 --port 3200
```

报：

```text
Error: Port 3200 is already in use
```

继续用 Playwright 截图时又出现：

```text
Error: net::ERR_CONNECTION_REFUSED at http://127.0.0.1:3200/...
```

## 触发条件

- 同一轮或上一轮定时任务曾在 `tmp/demo` 启动过 `vite dev` / `vite preview`
- 需要继续复用 `3200` 做浏览器或 Playwright 验收

## 根因

- `3200` 端口上可能残留旧的 `vite` 进程，导致新的 preview 无法绑定。
- 旧进程又不一定持续稳定存活，所以“端口刚刚还被占用”不等于“当前浏览器一定能连通”。

## 解法

1. 先检查当前监听者：

```bash
lsof -iTCP:3200 -sTCP:LISTEN -n -P
```

2. 如果已有旧进程，进一步看命令：

```bash
ps -p <PID> -o pid=,cmd=
```

3. 不要直接假设可复用；若 Playwright 已经报 `ERR_CONNECTION_REFUSED`，直接重新启动自己这一轮的 preview server。

## 验证方式

- 用 `lsof` 确认旧进程存在
- Playwright 首次截图报 `ERR_CONNECTION_REFUSED`
- 重新提权启动 `pnpm --dir tmp/demo/app exec vite preview --host 127.0.0.1 --port 3200` 后，截图恢复正常

## 复现记录

- `2026-04-14 01`：
  - `vite preview` 先报 `Port 3200 is already in use`
  - `lsof` 查到旧的 `node ... vite.js -- --host 0.0.0.0` 正在监听
  - 之后 Playwright 截图命中 `ERR_CONNECTION_REFUSED`
  - 重启 preview server 后恢复正常
