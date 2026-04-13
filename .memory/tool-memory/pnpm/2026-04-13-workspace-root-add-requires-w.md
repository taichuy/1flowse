---
memory_type: tool
topic: pnpm workspace 根目录 add 依赖需要显式加 -w
summary: 在 `web` 这类自身就是 pnpm workspace root 的目录执行 `pnpm --dir web add -D <pkg>` 会被 `ERR_PNPM_ADDING_TO_ROOT` 拦截；已验证做法是改用 `pnpm --dir web add -Dw <pkg>`。
keywords:
  - pnpm
  - add
  - workspace-root
  - ERR_PNPM_ADDING_TO_ROOT
  - -w
match_when:
  - 需要在 monorepo 的 workspace 根目录新增依赖
  - `pnpm add -D` 报 `ERR_PNPM_ADDING_TO_ROOT`
  - 目录既是项目入口又是 pnpm workspace root
created_at: 2026-04-13 15
updated_at: 2026-04-13 15
last_verified_at: 2026-04-13 15
decision_policy: reference_on_failure
scope:
  - pnpm
  - web
  - web/package.json
---

在本次 `style-boundary` 运行时回归实现中，先执行了 `pnpm --dir web add -D playwright`。

失败原因：
- `web` 目录自身是一个 pnpm workspace root，`pnpm` 默认拒绝在 workspace 根上直接 `add`，报 `ERR_PNPM_ADDING_TO_ROOT`。

已验证解法：
- 改为执行 `pnpm --dir web add -Dw playwright`，依赖成功写入 `web/package.json` 与 `web/pnpm-lock.yaml`。

避免建议：
- 后续在类似 `web` 这种 workspace 根目录补依赖前，先确认是否需要显式加 `-w`，不要把这类错误误判成网络或锁文件问题。
