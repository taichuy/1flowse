---
memory_type: feedback
feedback_category: repository
topic: 插件规范示例应使用项目作者与现有插件
summary: 讨论或编写插件规范、manifest、registry 和安装示例时，作者字段应使用项目当前作者 taichuy，示例插件优先使用仓库现有的 openai_compatible，而不是抄外部项目作者或随意造新插件名。
keywords:
  - plugin
  - spec
  - manifest
  - example
  - author
  - openai_compatible
match_when:
  - 讨论插件规范
  - 编写插件 manifest 样例
  - 编写 registry 或安装示例
  - 需要给出插件作者字段和示例插件
created_at: 2026-04-19 10
updated_at: 2026-04-19 10
last_verified_at: 2026-04-19 10
decision_policy: direct_reference
scope:
  - docs/superpowers/specs
  - 1flowbase-official-plugins
  - .memory/feedback-memory/repository
---

# 插件规范示例应使用项目作者与现有插件

## 时间

`2026-04-19 10`

## 规则

- 讨论或输出插件规范样例时，作者字段使用项目当前作者 `taichuy`。
- 示例插件优先使用仓库现有的 `openai_compatible`。
- 不要在示例中沿用外部项目作者名，也不要无必要新造插件名。

## 原因

- 规范讨论需要贴近当前项目真实上下文，避免把外部项目元数据误带进来。
- 使用现有插件举例更方便和仓库当前实现、目录、发布链路逐项对照。

## 适用场景

- 编写插件 `manifest` 草案
- 讨论插件注册表字段
- 讨论插件安装产物、发布产物和示例目录结构
- 需要给出文档中的示例 YAML 或 JSON
