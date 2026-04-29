---
memory_type: feedback
feedback_category: repository
topic: official-plugin-source-repo-reference
summary: 排查或修改官方插件时，优先使用相邻源码仓库 ../1flowbase-official-plugins，不把主仓 api/plugins/installed 当作源码入口。
keywords:
  - plugin-source
  - official-plugins
  - openai_compatible
  - api/plugins/installed
  - reference-memory
match_when:
  - 排查官方插件实现或插件流式输出问题时
  - 修改 openai_compatible 等官方插件源码时
  - 需要判断插件源码入口和安装态产物边界时
created_at: 2026-04-30 00
updated_at: 2026-04-30 00
last_verified_at: 2026-04-30 00
decision_policy: direct_reference
scope:
  - ../1flowbase-official-plugins
  - api/plugins/installed
  - .memory/reference-memory/source-reference.md
---

# 官方插件源码仓库入口

## 时间

`2026-04-30 00`

## 规则

排查或修改官方插件时，优先进入 `../1flowbase-official-plugins` 找源代码；`api/plugins/installed/` 是主仓里的安装态产物，不应作为首选源码修改入口。

## 原因

用户明确纠正：插件仓库在 `../1flowbase-official-plugins`。直接修改安装态目录容易改错位置，也不利于后续打包、发布和复用。

## 适用场景

- 修复 `openai_compatible` 等官方插件行为。
- 排查插件运行器、插件包、安装态产物与源仓库之间的差异。
- 更新引用记忆或工程规则时。

## 备注

若任务只是在主仓复现安装态运行结果，可以读取 `api/plugins/installed/`；但需要落源码修复时，应回到 `../1flowbase-official-plugins`。
