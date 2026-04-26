---
memory_type: feedback
feedback_category: interaction
topic: 前端浏览器操作默认使用 Playwright，不再走 Chrome 浏览器 MCP
summary: 用户已关闭谷歌浏览器 MCP，因为系统资源消耗过高；后续前端页面的浏览器打开、检查、截图和交互复现默认使用 Playwright，除非用户明确指定其他链路。
keywords:
  - frontend
  - browser
  - playwright
  - chrome-devtools
  - mcp
  - resource
match_when:
  - 需要对前端页面做浏览器级打开、检查、截图或交互复现
  - 准备使用 Chrome 浏览器 MCP 或 chrome-devtools 做前端验收
  - 需要决定前端浏览器工具链
created_at: 2026-04-17 08
updated_at: 2026-04-26 18
last_verified_at: 2026-04-17 08
decision_policy: direct_reference
scope:
  - frontend workflow
  - playwright
  - chrome-devtools
  - .agents/skills/frontend-development
---

# 前端浏览器操作默认使用 Playwright，不再走 Chrome 浏览器 MCP

## 时间

`2026-04-17 08`

## 规则

- 用户已关闭谷歌浏览器 MCP。
- 2026-04-26 18 用户再次反馈：页面测试后 Chrome DevTools MCP 残留 renderer / GPU 进程长期占用高 CPU，确认这条链路资源成本不可接受。
- 2026-04-26 21 用户补充确认：另一次高 CPU 是 `pnpm ... run-frontend-vitest.js run src/features/agent-flow/_tests/node-last-run-runtime.test.tsx` 测试进程本身，执行结束后进程自行退出；这类一次性测试高 CPU 不等同于浏览器残留。
- 后续前端相关浏览器操作默认使用 Playwright。
- 若非用户明确要求，不再主动走 Chrome 浏览器 MCP / `chrome-devtools` 链路。
- 浏览器级验收必须显式关闭页面、上下文和浏览器实例；能用无头、一次性脚本、目标测试或组件运行时测试完成时，不打开常驻可视化浏览器。

## 原因

- Chrome 浏览器 MCP 会消耗大量系统资源，用户已明确停用这条链路。

## 适用场景

- 需要打开前端页面做运行时检查。
- 需要用浏览器复现交互、截图或补充页面证据。
- 需要在多个浏览器工具链之间做默认选择。

## 备注

- 若 Playwright 当前环境缺浏览器二进制或截图链路受限，应优先结合项目已有 `style-boundary` 或其他已验证前端验收链路处理，不要默认回退到 Chrome 浏览器 MCP。
