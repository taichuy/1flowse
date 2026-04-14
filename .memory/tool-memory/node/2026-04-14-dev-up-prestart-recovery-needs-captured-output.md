---
memory_type: tool
topic: dev-up 预启动恢复逻辑在 stdio=inherit 时无法识别 migration checksum 错误
summary: 为 `scripts/node/dev-up.js` 增加失败恢复时，如果预启动命令仍用继承式 stdio，`spawnSync` 不会把 stderr 带回结果对象，恢复逻辑就读不到 `previously applied but has been modified`；已验证解法是对预启动统一 `captureOutput`，再把 stdout/stderr 主动回显。
keywords:
  - node
  - dev-up
  - spawnSync
  - captureOutput
  - migration checksum
match_when:
  - 为 `scripts/node/dev-up.js` 增加预启动失败恢复
  - 需要根据命令 stderr 判断是否走重试或自愈
  - 现场日志里能看到错误，但 `result.stderr` 为空
created_at: 2026-04-14 19
updated_at: 2026-04-14 19
last_verified_at: 2026-04-14 19
decision_policy: reference_on_failure
scope:
  - node
  - scripts/node/dev-up/core.js
---

# dev-up 预启动恢复逻辑在 stdio=inherit 时无法识别 migration checksum 错误

## 时间

`2026-04-14 19`

## 失败现象

`node scripts/node/dev-up.js restart` 现场终端已经打印：

- `Error: migration 20260412183000 was previously applied but has been modified`

但脚本内部恢复逻辑没有触发，仍然直接报：

- `api-server 开发态重置 root 密码 失败，退出码 1`

## 触发条件

- `dev-up` 的预启动命令通过 `spawnSync` 执行
- 命令选项没有开启 `captureOutput`
- 恢复逻辑依赖 `result.stderr` / `result.stdout` 识别特定失败模式

## 根因

当 `spawnSync` 使用继承式 stdio 时，错误会直接打印到终端，而不是回填到结果对象；脚本能“看到”人类终端日志，但程序分支拿不到关键错误文本。

## 解法

- 对需要脚本判断失败类型的预启动命令统一启用 `captureOutput`
- 成功或失败后都手动把 `stdout` / `stderr` 回显到终端，避免丢现场日志

## 验证方式

- `node --test scripts/node/dev-up/_tests/core.test.js`
- `node scripts/node/dev-up.js restart`

以上验证中，checksum mismatch 能被识别并触发本地开发数据库重建，随后 `api-server` 与 `plugin-runner` 正常启动。

## 复现记录

- `2026-04-14 19`：第一次为 `api-server` 预启动添加 checksum mismatch 自愈时，定向测试通过但真实 `dev-up restart` 仍失败；补上 `captureOutput` 并主动回显输出后恢复正常。
