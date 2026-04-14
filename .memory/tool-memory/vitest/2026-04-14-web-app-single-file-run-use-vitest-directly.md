---
memory_type: tool
topic: web/app 跑单个 Vitest 文件时不要走 pnpm test -- --run，会把执行范围跑偏
summary: `web/app` 的 `test` 脚本本身已经是 `vitest --run`；再执行 `pnpm test -- --run <file>` 会把额外参数透传成 `vitest --run -- --run <file>`，结果不是稳定的单文件执行。已验证应改用 `pnpm exec vitest run <file>`。
keywords:
  - vitest
  - pnpm
  - single-file
  - web/app
  - --run
match_when:
  - 需要在 `web/app` 只跑一个测试文件
  - 想执行 `pnpm test -- --run <file>`
  - 看到范围没有收敛到目标文件或拉起整批测试
created_at: 2026-04-14 22
updated_at: 2026-04-14 22
last_verified_at: 2026-04-14 22
decision_policy: reference_on_failure
scope:
  - vitest
  - pnpm
  - web/app
  - web/app/package.json
---

# web/app 跑单个 Vitest 文件时不要走 pnpm test -- --run，会把执行范围跑偏

## 时间

`2026-04-14 22`

## 失败现象

执行：

```bash
pnpm test -- --run src/features/settings/_tests/api-docs-panel.test.tsx
```

实际展开为：

```text
vitest --run "--" "--run" "src/features/settings/_tests/api-docs-panel.test.tsx"
```

结果把多组无关测试也一起跑起来，而不是稳定只跑目标文件。

## 触发条件

- 当前目录是 `web/app`
- `package.json` 里的脚本已写成 `test: "vitest --run"`
- 还想再通过 `pnpm test -- --run <file>` 追加单文件参数

## 根因

脚本自身已经包含 `--run`，再通过 `pnpm test -- --run ...` 追加一次，会把参数以不符合预期的方式透传给 `vitest`。

## 已验证解法

直接执行 `vitest` 二进制，不走包脚本：

```bash
pnpm exec vitest run src/features/settings/_tests/api-docs-panel.test.tsx
```

这样可以稳定只跑目标文件。

## 后续避免建议

- 在 `web/app` 需要单文件验证时，优先用 `pnpm exec vitest run <file>`
- 只有在确实要跑整批测试时，再用 `pnpm test`
