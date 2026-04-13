---
memory_type: tool
topic: Vitest 默认 5 秒超时在慢速 App 套件下可能误报失败
summary: 在 `web/app` 中一次性跑多组前端测试时，`src/app/App.test.tsx` 的 `renders the bootstrap shell and health state` 可能因 jsdom 与 Ant Design 渲染耗时触发默认 `5000ms` 超时；已验证可用显式 `--testTimeout=15000` 重新确认真实断言结果。
keywords:
  - vitest
  - timeout
  - jsdom
  - antd
  - web/app
match_when:
  - `App.test.tsx` 报 `Test timed out in 5000ms`
  - 一次性运行多组前端测试时出现不稳定超时
created_at: 2026-04-13 12
updated_at: 2026-04-13 12
last_verified_at: 2026-04-13 12
decision_policy: reference_on_failure
scope:
  - vitest
  - web/app
  - web/app/src/app/App.test.tsx
---

# Vitest 默认 5 秒超时在慢速 App 套件下可能误报失败

## 时间

`2026-04-13 12`

## 失败现象

在 `web/app` 里把 `src/app/_tests/*` 和 `src/app/App.test.tsx` 一起跑时，`renders the bootstrap shell and health state` 会报：

```text
Test timed out in 5000ms.
```

但同一断言在显式提高超时后可以正常通过。

## 触发条件

- `vitest` 默认 `5000ms` 超时
- `jsdom` 环境
- `Ant Design` 菜单与壳层渲染较重
- 同一轮同时执行多组前端测试

## 根因

这是测试环境性能噪声，不是断言逻辑错误。套件一起跑时，`App.test.tsx` 的首个集成测试渲染链路较长，超过默认超时。

## 解法

1. 先查看是否为超时而非断言失败。
2. 对该测试命令显式加更长超时，例如：
   - `pnpm test -- --testTimeout=15000 src/app/App.test.tsx`
3. 用提高超时后的结果判断真实回归状态，不要把默认超时报错直接当成逻辑失败。

## 验证方式

`2026-04-13 12` 已验证：提高到 `15000ms` 后，`App.test.tsx` 全部断言通过。
