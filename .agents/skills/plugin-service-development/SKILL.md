---
name: plugin-service-development
description: 用于处理 `services/` 下的 compat adapter、插件目录、调用代理与外部生态翻译边界，适用于插件/兼容服务的实现、审查、补测和文档同步。
---

# 7Flows 插件 / 兼容服务开发

## 何时使用

当任务涉及以下任一场景时使用：

- `services/compat-*` 下的服务实现、重构、审查或补测
- plugin catalog、manifest 转译、invoke contract、adapter health check
- 外部插件生态与 `7Flows IR` 之间的翻译边界
- 兼容服务 README、目录说明和 skill 案例同步

不要用于：

- `api/` 主运行时调度、数据库迁移或 published surface 主链
- `web/` 工作台页面与前端交互
- 单纯的产品愿景讨论

## 先读哪些事实

- 根目录 `AGENTS.md`
- `services/AGENTS.md`
- `docs/open-source-positioning.md`
- `docs/product-design.md`
- `docs/technical-design-supplement.md`
- `docs/dev/team-conventions.md`
- 命中的服务 `README.md`

如当前本地开发者已维护本地连续性资料，再补读：

- `docs/.private/user-preferences.md`
- `docs/.private/runtime-foundation.md`

详细案例见 [references/use-cases.md](references/use-cases.md)。

## 核心边界

- compat service 负责外部生态接入、翻译、调用代理和健康检查，不承担工作流主控。
- `compat adapter` 与 `sandbox backend` 必须职责分离；不要把隔离执行注册、profile 解释或主 runtime 调度塞进 `services/`。
- 服务内翻译逻辑始终以 `7Flows IR` 为上游事实，不让外部协议反向主导内部模型。
- 服务开发继续遵守 local-first、loopback-first；不要把新的远程脚本或外部托管依赖写进共享主链。

## 开发流程

1. 先确认当前任务是在补“服务边界”还是补“运行时主链”，不要混层实现。
2. 如果接口仍有多种方案，先列出服务内可选方案、好处、代价和推荐方案，再动手。
3. 优先先打通一条完整的 catalog / translate / invoke / health 主链，再根据测试结果回归修复，而不是把任务切成很细的零碎步骤。
4. 如果兼容服务 contract、目录结构或协作规则发生变化，同步更新服务 README、`services/AGENTS.md`、`.agents/skills/README.md` 和相关 ADR。

## 验证要求

- 至少运行命中的服务测试。
- 如果改动影响 `api/` 与 `services/` 之间的契约，补充或运行对应联动测试。
- 纯文档 / skill 调整至少执行 `git diff --check`，并核对索引引用与目录名称是否一致。
