---
memory_type: tool
topic: pnpm --dir web test 走 Turbo cache replay 时可能混入旧失败日志
summary: 执行 `pnpm --dir web test` 时，如果命中 Turbo cache replay，输出可能夹带旧的失败日志片段，即使当前进程退出码为 `0`；遇到这种矛盾结果时，应以当前退出码和直跑目标工作区测试为准。
keywords:
  - pnpm
  - turbo
  - cache
  - replay
  - vitest
  - stale-log
match_when:
  - 执行 `pnpm --dir web test`
  - 输出包含 `cache hit, replaying logs`
  - 日志里同时出现旧失败片段与当前成功摘要
created_at: 2026-04-17 18
updated_at: 2026-04-17 18
last_verified_at: 2026-04-17 18
decision_policy: reference_on_failure
scope:
  - pnpm
  - web
  - turbo
  - vitest
---

# pnpm --dir web test 走 Turbo cache replay 时可能混入旧失败日志

## 时间

`2026-04-17 18`

## 为什么做这个操作

- 需要在模块 05 Task 6 里重跑前端测试门禁，确认后端验证修复后前端仍保持绿色。

## 失败现象

- `pnpm --dir web test` 输出里先出现：

```text
cache hit, replaying logs
```

- 随后日志混入旧的 `No QueryClient set` 和 `ELIFECYCLE Test failed` 片段，但当前命令实际退出码仍为 `0`。

## 触发条件

- `pnpm --dir web test` 命中 Turbo 缓存；
- Turbo 直接回放历史日志；
- 历史日志本身包含失败片段，而当前缓存结果已经成功。

## 根因

- 这是 Turbo cache replay 的日志污染，不是当前这一轮测试真实失败。
- 聚合输出会原样回放缓存命令历史日志，因此文字内容不一定只代表当前执行结果。

## 解法

- 先看当前命令退出码，不要只看回放日志文本。
- 遇到“退出码成功但日志夹带旧失败”的矛盾情况，直接对目标工作区直跑测试，例如：

```bash
pnpm --dir web/app exec vitest --run
```

- 以后需要可审计、无歧义的测试证据时，优先保留直跑工作区命令的结果。

## 验证方式

- `2026-04-17 18` 已验证：`pnpm --dir web test` 返回退出码 `0` 但日志夹带旧失败片段；随后直跑 `pnpm --dir web/app exec vitest --run`，得到当前确定性结果 `43 passed / 138 passed`。

## 后续避免建议

- 需要给计划、PR 或交付说明写“当前测试结果”时，不要直接引用 Turbo replay 的混合日志；应补一条不走聚合缓存的工作区级测试命令作为最终证据。

## 复现记录

- `2026-04-17 18`：模块 05 Task 6 重跑前端测试时，`pnpm --dir web test` 因 Turbo cache replay 混入旧的 `No QueryClient set` 失败片段；改用 `pnpm --dir web/app exec vitest --run` 后拿到当前确定性通过结果。
