---
memory_type: project
topic: 前端样式边界检测转向运行时回归
summary: 本轮已确认前端样式边界检测不采用静态 selector 扫描主导，而采用独立宿主加无头浏览器的运行时回归；组件和页面默认走宿主场景，文件模式依赖显式场景映射。
keywords:
  - frontend
  - style-boundary
  - runtime-regression
  - browser
  - harness
match_when:
  - 需要继续实现前端样式边界检测脚本
  - 需要讨论前端 QA 门禁如何执行
  - 需要决定组件和页面样式回归方案
created_at: 2026-04-13 14
updated_at: 2026-04-13 14
last_verified_at: 2026-04-13 14
decision_policy: verify_before_decision
scope:
  - scripts/node
  - web/app/src/style-boundary
  - .agents/skills/frontend-development
  - .agents/skills/qa-evaluation
  - DESIGN.md
---

# 前端样式边界检测转向运行时回归

## 时间

`2026-04-13 14`

## 谁在做什么

- 用户要求为 `web/` 建立前端样式边界检测能力，但不修改 `web/app` 业务逻辑。
- AI 负责设计并后续实现独立宿主、场景注册表和浏览器回归脚本。

## 为什么这样做

- 现有 `DESIGN.md`、`frontend-development` 和 `qa-evaluation` 已经定义了样式边界原则，但缺少真实可执行的回归抓手。
- 用户明确否决“只扫描 selector 写法”的方案，因为它无法证明真实渲染结果，也无法稳定支持未来带权限和后端依赖的页面。

## 为什么要做

- 让开发者在开发完成后，可以对单组件、页面和文件影响面做中等粒度的真实样式回归。
- 让 QA 和覆盖检测后续可以直接使用浏览器产出的样式来源与截图证据，而不是依赖主观判断。

## 截止日期

- 未指定

## 决策背后动机

- 脚本入口放在 `scripts/node`，目标工作区为 `web/`。
- 组件和页面默认都走独立宿主场景，少量页面可额外声明真实路由场景。
- `--file` 模式依赖显式场景注册表，不做自动猜测式影响面推断。
- `global.css` 可作为合法样式来源，但不做整文件豁免，必须通过真实场景验证其影响。
- 本轮不引入中心化 exemption/allowlist 机制，避免白名单快速腐化。
