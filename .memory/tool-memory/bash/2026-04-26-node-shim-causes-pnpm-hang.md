---
memory_type: tool
topic: AionUI 环境下 Bun node shim 会导致 pnpm/vitest 卡住
summary: 当前 shell 的 `node` 可能指向 `/tmp/bun-node-*` 下的 Bun shim，直接执行 `pnpm`、`node --version` 或定向 Vitest 可能卡住或报 Bun wrapper 错误；已验证可复用解法是用真实 Node 路径显式调用 pnpm 或脚本。
keywords:
  - bash
  - node
  - pnpm
  - bun
  - vitest
  - aionui
match_when:
  - pnpm 命令无输出并长时间卡住
  - node --version 报 Bun wrapper 错误
  - 定向 Vitest 启动后没有测试输出
created_at: 2026-04-26 14
updated_at: 2026-04-26 14
last_verified_at: 2026-04-26 14
decision_policy: reference_on_failure
scope:
  - bash
  - pnpm
  - vitest
  - web
---

# AionUI 环境下 Bun node shim 会导致 pnpm/vitest 卡住

## 时间

`2026-04-26 14`

## 失败现象

- `node --version` 输出 `Bun's provided 'node' cli wrapper does not support a repl.`
- `pnpm --version` 和 `pnpm --dir web/app exec vitest ...` 长时间无输出。
- `ps` 显示 `pnpm` 进程仍在运行，但没有继续产出测试结果。

## 根因

当前 shell 的 `node` 解析到了 `/tmp/bun-node-*/node`，而不是项目期望的真实 Node。`pnpm` 通过 shebang/env node 启动时会吃到该 shim。

## 已验证解法

显式使用真实 Node 调 pnpm：

```bash
/home/taichu/.nvm/versions/node/v22.12.0/bin/node /home/taichu/.nvm/versions/node/v22.12.0/bin/pnpm --dir web/app exec vitest run <test-file>
```

需要直接跑脚本时也显式使用真实 Node：

```bash
/home/taichu/.nvm/versions/node/v22.12.0/bin/node scripts/node/check-style-boundary.js file <path>
```

## 验证记录

- `2026-04-26 14`：直接 `pnpm --dir web/app exec vitest ...` 卡住；改用真实 Node 调 pnpm 后，目标 Vitest 正常输出并完成。
