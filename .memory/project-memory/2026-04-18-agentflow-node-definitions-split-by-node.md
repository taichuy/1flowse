---
memory_type: project
topic: agentflow 节点定义按节点文件拆分到独立子目录
project_memory_state: implemented
summary: 用户明确否决把所有节点定义继续堆在单个 `node-definitions` 文件中，要求改为独立子目录承载不同节点；当前实现已将 `web/app/src/features/agent-flow/lib/node-definitions` 拆为共享入口、meta/types/base 与 `nodes/*` 单节点文件。
keywords:
  - agentflow
  - node definitions
  - schema registry
  - directory structure
  - node schema
match_when:
  - 后续继续新增 agentflow 节点类型
  - 需要判断节点定义应集中在单文件还是拆分到目录
  - 需要定位节点 schema/definition 的维护入口
created_at: 2026-04-18 00
updated_at: 2026-04-18 00
last_verified_at: 2026-04-18 00
decision_policy: verify_before_decision
scope:
  - web/app/src/features/agent-flow/lib/node-definitions
  - web/app/src/features/agent-flow/schema
---

# agentflow 节点定义按节点文件拆分到独立子目录

## 时间

`2026-04-18 00`

## 谁在做什么

- 用户在审看 `node-definitions` 结构时，指出把所有节点 schema/definition 堆在一个文件里会让后续新增节点很不方便。
- AI 已按该要求把节点定义层拆到独立子目录，并保持原有对外导出函数与消费路径不变。

## 为什么这样做

- 单文件集中维护会持续膨胀，新增节点时改动面大、冲突概率高，定位成本也高。
- 当前 schema runtime 已经有 registry/fragments 分层，节点定义真值层继续堆回单文件，会抵消这层抽象带来的可维护性收益。

## 为什么要做

- 固定“新增节点 = 新增一个节点定义文件 + 在聚合入口注册”的维护路径。
- 让节点定义层和 schema registry 一样具备可扩展的目录结构，避免未来继续做大文件拆分。

## 截止日期

- 无

## 决策背后动机

- `node-definitions/` 根目录只保留共享类型、基础字段、meta 和聚合入口。
- 具体节点定义进入 `node-definitions/nodes/*.ts`，每种节点一个文件。
- 对外仍通过 `../lib/node-definitions` 暴露统一 API，避免消费层无意义扩散改动。
