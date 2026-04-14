---
memory_type: tool
topic: jsdom 环境里直接 import `vite.config.ts` 可能触发 esbuild TextEncoder 不变量错误
summary: 在 `web/app` 的 Vitest jsdom 测试里直接 `import vite.config.ts` 时，可能因为当前测试环境的 `TextEncoder`/`Uint8Array` 组合不满足 esbuild 预期而报 `Invariant violation`；已验证可复用做法是改成读取配置源码文本做断言，或放到纯 Node 测试环境里执行。
keywords:
  - vitest
  - jsdom
  - vite.config
  - esbuild
  - TextEncoder
  - invariant
match_when:
  - 在 Vitest jsdom 测试中直接 import `vite.config.ts`
  - 报错包含 `new TextEncoder().encode(\"\") instanceof Uint8Array`
  - 需要验证 Vite 配置但不想启动真实 Vite 进程
created_at: 2026-04-15 07
updated_at: 2026-04-15 07
last_verified_at: 2026-04-15 07
decision_policy: reference_on_failure
scope:
  - vitest
  - web/app/vite.config.ts
  - web/app/src/app/_tests
---

# jsdom 环境里直接 import `vite.config.ts` 可能触发 esbuild TextEncoder 不变量错误

## 时间

`2026-04-15 07`

## 失败现象

在 `web/app` 的 Vitest jsdom 测试里直接 `import ../../../vite.config`，执行时出现：

`Invariant violation: "new TextEncoder().encode(\"\") instanceof Uint8Array" is incorrectly false`

## 为什么要做这个操作

需要给本次 Scalar 文档同源代理修复补一条测试，验证 `vite.config.ts` 里确实新增了 `/api`、`/health`、`/openapi.json` 的代理入口。

## 为什么失败

`vite.config.ts` 的 import 链会拉起 `vite` / `esbuild` 相关初始化，而当前 jsdom 测试环境下的 `TextEncoder` 能力不满足 esbuild 的运行前置假设，所以失败不是业务逻辑错误，而是测试环境与工具初始化方式不兼容。

## 已验证做法

不要在 jsdom 用例里直接 import `vite.config.ts`。改成：

1. 直接读取 `vite.config.ts` 源码文本并断言关键代理配置片段；
2. 或者把该用例放到纯 Node 测试环境里，再执行真实配置对象解析。

## 后续避免建议

凡是要在 jsdom 里验证构建工具配置时，先判断该配置 import 是否会触发 `vite`、`esbuild`、`rollup` 这类工具链初始化；如果会，优先用源码级断言或 Node 环境专用测试，避免把工具链初始化硬塞进浏览器模拟环境。
