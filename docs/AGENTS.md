# docs 协作说明

先读根目录 [AGENTS.md](/E:/code/taichuCode/7flows/AGENTS.md)，再处理 `docs/` 下的文档。

## 文档分层

- `README.md`
  - 面向仓库入口，只讲项目定位、当前能力、诚实边界、开发方式和索引入口。
- `docs/open-source-positioning.md`
  - 面向开源项目定位，只讲当前开源项目能做什么、聚焦什么、暂不承诺什么。
- `docs/product-design.md`
  - 产品基线、核心模型与目标设计。
- `docs/technical-design-supplement.md`
  - 技术基线、协议边界与实现约束。
- `docs/dev/team-conventions.md`
  - 团队级共享协作规则。
- `docs/adr/`
  - 长期保留“背景 / 决策 / 后果”的事项。

## 写作规则

- 共享文档优先链式引用，不在多个入口重复搬运同一大段规则。
- 不把个人偏好、启动提示词、机器路径、临时草稿和按日期过程记录写进共享仓库。
- 共享文档默认不维护细碎执行计划；阶段性推进和当前轮优先级应放在 `docs/.private/`。
- 如果一条规则已经足够稳定且会长期约束后续开发，优先写入 `team-conventions` 或 ADR，而不是继续留在某一篇说明文里。
- 已废弃但有历史价值的文档移入 `docs/expired/`，并写明废弃原因、替代入口和日期。

## 同步要求

- 变更入口文档、目录结构或事实源时，同步更新 `docs/README.md`、`docs/dev/README.md` 和相关 ADR。
- 如果改动影响 AI 协作入口，还要同步检查 `.agents/AGENTS.md` 与 `.agents/skills/README.md`。
