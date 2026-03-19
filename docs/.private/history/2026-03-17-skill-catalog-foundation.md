# 2026-03-17 Skill Catalog Foundation

## 背景

- `docs/product-design.md` 与 `docs/technical-design-supplement.md` 已把 product skill 定义为 service-hosted 的轻量 `SkillDoc`，用于 `llm_agent` 的认知注入与 reference retrieval。
- `docs/dev/runtime-foundation.md` 与 `docs/open-source-commercial-strategy.md` 仍把这条能力标记为“尚未落地”，与当前需要继续推进 AI 协作层闭环的优先级不一致。
- 当前 `llm_agent` 已具备 phase pipeline、tool policy、assistant evidence distill，但缺少服务侧 skill source of truth、引用 guard 和真正的 prompt injection path。

## 目标

- 落地最小 product-level `SkillDoc` 模型、REST catalog surface 与 reference retrieval。
- 让 `llm_agent` 能在运行时按 `skillIds` 拉取 skill 正文与 reference 摘要，并注入 LLM prompt 上下文。
- 在 workflow / workspace starter 持久化前拦截不存在的 `skillIds`，避免静默漂移。
- 给 editor 提供最小可用的人类配置入口，不把实现停留在纯后端事实层。

## 实现

- 后端新增 `skills` / `skill_references` 模型、对应 schema、service 与 Alembic migration：
  - `api/app/models/skill.py`
  - `api/app/schemas/skill.py`
  - `api/app/services/skill_catalog.py`
  - `api/migrations/versions/20260317_0024_skill_catalog.py`
- 新增 `/api/skills` REST surface，支持 list / create / get / update / delete 以及 `GET /api/skills/{skill_id}/references/{reference_id}`。
- `AgentRuntime` 新增 skill catalog 依赖；`llm_agent` 节点读取 `config.skillIds` 后，会按 workspace 解析 SkillDoc，并把技能正文与 reference 摘要放进 `skill_context`，再由 `build_llm_call_config` 注入 `[Skills]` 区块。
- workflow / workspace starter 持久化校验新增 `skill_reference` guard；缺失 skill 文档时会返回结构化 validation issue，而不是允许定义先落库、运行时再无提示漂移。
- editor 的 `llm_agent` 配置面板新增最小 `Skill IDs` 文本入口，用于人类在节点上直接绑定服务侧 skill。

## 影响范围

- AI 与人协作层：`llm_agent` 首次具备服务侧 skill 认知注入主链，不再只能依赖 prompt 手写或仓库内 `.agents/skills` 的开发态知识。
- 用户层：工作流编辑器现在可直接配置 `skillIds`，虽然仍是轻量文本入口，但已形成“人配置 -> 后端校验 -> runtime 注入”的完整闭环。
- 架构层：这次实现增强了扩展性与兼容性，因为 skill catalog 被建成独立 service-hosted 资产，没有反向污染 `7Flows IR` 为第二套 DSL；同时也增强了可靠性，因为不存在的 skill 引用会在 persistence 阶段 fail-fast。
- 边界上仍保持克制：本轮没有引入 SkillHub、本地下载安装、客户端接管、reference body 自动全量注入或 MCP retrieval，只落地最小 REST + prompt injection 基线。

## 验证

- `api/.venv/Scripts/uv.exe run pytest -q tests/test_skill_routes.py tests/test_llm_provider.py tests/test_agent_runtime_llm_integration.py tests/test_workflow_routes.py tests/test_workspace_starter_routes.py`
- `api/.venv/Scripts/uv.exe run pytest -q`
- `web/pnpm exec tsc --noEmit`
- `web/pnpm lint`

## 下一步

1. 为 `SkillDoc` 补最小 MCP retrieval surface，并明确 REST / MCP 的统一 contract，而不是继续把 retrieval 停留在 REST-only。
2. 把 editor 中的 `skillIds` 从纯文本入口升级为 catalog picker / summary preview，降低配置错误率。
3. 为 `llm_agent` 明确 skill 绑定策略与注入策略，例如候选 skill、phase 差异、reference lazy fetch 与 prompt budget 控制。
4. 再推进 team / workspace / governance 领域模型，避免 skill catalog 长期卡在单 workspace 默认形态。
