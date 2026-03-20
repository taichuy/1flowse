# .agents 协作说明

先读根目录 [AGENTS.md](/E:/code/taichuCode/7flows/AGENTS.md)，再处理 `.agents/`。

## 目录定位

- `.agents/skills/` 保存 AI 协作技能、检查清单和参考资料。
- 这里是开发协作资产，不是产品运行时的 `SkillDoc`。

## 维护规则

- 技能描述优先写“何时触发”，不要在 `description` 里塞完整流程。
- 共享规则放根 `AGENTS.md` 或 `docs/dev/team-conventions.md`；技能正文只保留可复用流程。
- 详细案例、长清单和参考资料优先下沉到 `references/` 或 `.agents/skills/README.md`。
- 当前技能按“元流程 / 后端 / 前端 / 插件服务 / 特例”分组维护。

## 同步要求

- 新增、删除、重命名或实质重构 skill 时，同步更新：
  - `.agents/skills/README.md`
  - `README.md`
  - `docs/README.md`
  - `docs/dev/README.md`
  - 相关目录的 `AGENTS.md`
- 触及 prompt、skill、治理文档、脚本或本地执行边界时，收尾前组合 `safe-change-review`。
