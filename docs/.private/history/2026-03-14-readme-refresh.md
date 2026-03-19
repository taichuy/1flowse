# 2026-03-14 README 刷新

## 背景

- 根目录 `README.md` 仍停留在“工程初始化”口径，已经落后于当前项目事实。
- 当前仓库已经不只是基础骨架：运行时、发布治理、诊断接口和工作台入口都已有明显落地，需要新的入口文档统一说明。
- 仓库协作约定要求在设计基线、当前事实与 README 发生偏差时及时补文档，而不是继续沿用过时描述。

## 目标

- 把根目录 `README.md` 更新为符合当前代码事实的仓库入口文档。
- 明确项目定位、当前已落地能力、尚未完成边界、目录结构、开发启动方式和文档分层。
- 让新进入仓库的人先看 README 就能知道“项目现在做到哪了、怎么跑起来、接下来优先做什么”。

## 实现方式

- 结合 `AGENTS.md`、`docs/product-design.md`、`docs/technical-design-supplement.md`、`docs/dev/runtime-foundation.md`、`docs/dev/user-preferences.md` 重新整理 README 文案。
- 保留实际可执行的本地开发命令：middleware compose、`uv` 启动 API、worker、scheduler，以及 `pnpm` 启动前端。
- 新增“当前已落地能力”“当前未完成边界”“关键接口与界面现状”“文档分层”“当前优先级”等章节，避免 README 继续只反映初始化状态。
- 在 `docs/dev/runtime-foundation.md` 中同步记录 README 已完成刷新，保持当前事实索引与入口文档一致。

## 影响范围

- 根目录 `README.md`
- `docs/dev/runtime-foundation.md`
- 仓库入口认知、协作对齐和新成员上手路径

## 验证

- 逐项核对 README 中的命令、目录与 compose 文件名，确认与当前仓库结构一致。
- 逐项对照产品设计、技术补充和 runtime foundation，确认项目定位与当前能力表述没有回退到“仅初始化骨架”。

## 下一步

- 后续若运行时、发布治理或工作台主入口继续演进，应把 README 视为“仓库入口事实页”持续刷新，而不是只在大改动时一次性补写。
