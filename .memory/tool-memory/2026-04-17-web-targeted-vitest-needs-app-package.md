---
memory_type: tool
topic: web 层 `pnpm test` 走 turbo，单文件 vitest 需要在 `web/app` 包内执行
summary: 当在仓库根执行 `pnpm --dir web test --run <path>` 时，`turbo run test` 会把 `--run` 当成自己的参数并直接报错；已验证可复用的做法是对单文件测试改用 `pnpm --dir web/app test <path>`。
keywords:
  - pnpm
  - turbo
  - vitest
  - web
  - single-file-test
match_when:
  - 需要在 `web` 前端只跑某一个 `vitest` 文件
  - 运行 `pnpm --dir web test --run ...` 时出现 `unexpected argument '--run'`
created_at: 2026-04-17 23
updated_at: 2026-04-17 23
last_verified_at: 2026-04-17 23
decision_policy: reference_on_failure
scope:
  - pnpm --dir web test
  - pnpm --dir web/app test
  - web
---

# web 层 `pnpm test` 走 turbo，单文件 vitest 需要在 `web/app` 包内执行

## 时间

`2026-04-17 23`

## 失败现象

- 运行 `pnpm --dir web test --run web/app/src/features/...` 后，命令直接报 `unexpected argument '--run'`。
- 输出停在 `turbo run` 的参数帮助，不会真正进入 `vitest`。

## 触发条件

- 想在 `web` 层只跑某一个前端测试文件。
- 沿用 `vitest` 的 `--run` 参数，直接透传给 `pnpm --dir web test`。

## 根因

- `web/package.json` 的 `test` 脚本是 `turbo run test --concurrency=50%`。
- `--run` 被 `turbo` 自己解析，不会自动透传给 `web/app` 包里的 `vitest`。

## 已验证解法

- 单文件前端测试不要走 `web` 层聚合脚本，直接下钻到 `web/app`：
  - `pnpm --dir web/app test src/features/agent-flow/_tests/detail-panel-width.test.ts`
  - `pnpm --dir web/app test src/features/agent-flow/_tests/agent-flow-editor-page.test.tsx`
- 只有跑整包回归时，才使用 `pnpm --dir web test`。

## 验证方式

- 上述两条 `web/app` 命令都已真实执行，并成功进入 `vitest --run`。
- `pnpm --dir web test` 在本轮用于整包回归，能够正常跑完 `turbo` 聚合测试。

## 复现记录

- `2026-04-17 23`：节点详情 UI 修复时，首次用 `pnpm --dir web test --run <path>` 失败；改成 `pnpm --dir web/app test <path>` 后验证通过。
