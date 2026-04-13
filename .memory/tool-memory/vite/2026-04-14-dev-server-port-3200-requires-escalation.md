---
memory_type: tool
topic: vite dev 在当前环境监听 3200 端口会报 EPERM，需要提权
summary: 在当前环境中从 `tmp/demo/app` 启动 `pnpm dev` 监听 `0.0.0.0:3200` 时，沙箱内会报 `listen EPERM: operation not permitted`；提权后可正常启动并用于浏览器检查。
keywords:
  - vite
  - dev
  - EPERM
  - port 3200
  - tmp/demo
match_when:
  - 需要在 `tmp/demo/app` 启动 `vite dev`
  - 监听 `3200` 端口时报 `listen EPERM`
  - 需要用浏览器检查 demo 页面
created_at: 2026-04-14 01
updated_at: 2026-04-14 01
last_verified_at: 2026-04-14 01
decision_policy: reference_on_failure
scope:
  - vite
  - tmp/demo/app
  - 3200
---

# vite dev 在当前环境监听 3200 端口会报 EPERM，需要提权

## 时间

`2026-04-14 01`

## 失败现象

执行：

```bash
pnpm --dir tmp/demo/app dev -- --host 0.0.0.0
```

报：

```text
Error: listen EPERM: operation not permitted 0.0.0.0:3200
```

## 为什么会失败

- 当前沙箱不允许该 dev server 直接绑定本地监听端口。
- `tmp/demo/app` 的 `vite.config.ts` 已固定 `port: 3200`，所以命令会直接命中这个受限端口。

## 已验证解法

- 使用提权执行同一条 `pnpm --dir tmp/demo/app dev -- --host 0.0.0.0`
- 提权后成功输出本地地址并可用于浏览器检查

## 后续避免建议

- 需要浏览器验证 `tmp/demo` 时，默认预期要对 `vite dev` 提权，不要反复在沙箱内空跑
- 若只是做静态验证，优先先跑 `lint / test / build`，再决定是否启动本地 dev server
