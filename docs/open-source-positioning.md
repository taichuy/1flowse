# 7Flows 开源项目定位

## 一句话定位

7Flows 是一个面向多 Agent 协作的可视化工作流平台，当前以 OpenClaw / 本地 AI 助手“黑盒变透明”为切口，对外提供可编排、可调试、可发布、可兼容、可追溯的开源基础能力，并坚持在“人”“人 + AI 协作”“AI 自治”三种场景下保持统一事实、可观察性以及结果 / 数据一致性。

## 当前开源项目聚焦

- 以 `7Flows IR`、runtime、published surface、trace / replay 和 compat adapter 作为内核。
- 优先解决工作流执行看不清、工具调用难追踪、waiting / resume 难排障的问题。
- 为自部署、社区协作和本地 AI 助手场景提供稳定的开源入口。
- 首版兼容重点仍是 Dify 插件生态接入，而不是复刻完整 Dify 平台。


## 对文档和协作的要求

- `README.md` 与本文保持聚焦当前开源项目定位、能力和诚实边界，不承载详细路线计划。
- 产品目标设计继续放在 `docs/product-design.md`，技术补充继续放在 `docs/technical-design-supplement.md`。
- 涉及长期协作规则、技能治理和本地记忆边界时，优先查看 `docs/dev/team-conventions.md`、`docs/adr/` 与对应 `AGENTS.md`。
