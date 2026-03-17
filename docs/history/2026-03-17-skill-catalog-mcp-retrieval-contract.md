# 2026-03-17 Skill Catalog MCP retrieval contract

## 背景

- `docs/dev/runtime-foundation.md` 已把 Skill Catalog 的下一步收敛到两件事：先补 `MCP retrieval contract`，再把 reference lazy fetch 从静态配置推进到真正 runtime-driven。
- 当前代码虽然已有 `SkillDoc`、REST catalog、editor picker / binding strategy、`llm_agent` phase-aware 注入，以及 selected reference body 的 opt-in 注入，但 deeper material 仍主要依赖作者预先勾选并直接塞进 prompt。
- 用户本轮再次强调：开发优先级应从“用户层 / 人与 AI 协作层 / AI 治理层”的全局完整度出发，而不是继续在 callback/publish 细枝末节上局部打磨。因此本轮优先推进 Skill Catalog 的 retrieval 主线。

## 目标

1. 为 Skill Catalog 补一条与 REST 对齐的最小 MCP retrieval contract。
2. 让 `llm_agent` 注入的 reference summary 自带 lazy-fetch handle，而不是只有摘要和正文二选一。
3. 保持 `SkillDoc` 仍然是 service-hosted 的轻量认知注入层，不引入 SkillHub、本地下载或客户端接管。

## 实现

### 1. `skills` route 增加 MCP 调用入口

- `api/app/api/routes/skills.py`
  - 新增 `POST /api/skills/mcp/call`
  - 支持：
    - `skills.list`
    - `skills.get`
    - `skills.get_reference`
- 这条 surface 与现有：
  - `GET /api/skills`
  - `GET /api/skills/{skill_id}`
  - `GET /api/skills/{skill_id}/references/{reference_id}`
  指向同一份服务侧事实，没有分叉第二套 skill 数据源。

### 2. `SkillCatalogService` 新增 retrieval contract 与 handle 生成

- `api/app/services/skill_catalog.py`
  - 新增 `invoke_mcp_method()`，统一处理 `skills.list / get / get_reference`
  - 新增 `build_reference_retrieval()`，为每个 reference 生成：
    - `http_path`
    - `mcp_method`
    - `mcp_params`
- `build_prompt_docs()` 现在会把 retrieval handle 附到每个 `SkillPromptReference` 上。

### 3. `SkillPromptReference` 升级为 lazy-fetch-ready

- `api/app/schemas/skill.py`
  - `SkillPromptReference` 新增 `retrieval`
  - 新增 `SkillMcpCall` / `SkillMcpResponse` schema
- 结果是：
  - selected reference body 仍保持 opt-in
  - 未选中的 reference 虽然不进正文，但主 AI 已经能在 prompt 里看到“如何按需取正文”

## 为什么这轮值得做

### 对架构链条的帮助

- **扩展性**：Skill retrieval 仍留在独立 catalog service 内，没有把 retrieval 逻辑塞进 `AgentRuntime` 主控，也没有新建第二套 DSL。
- **兼容性**：REST 与 MCP 共用同一份 SkillDoc / SkillReferenceDoc 事实，后续外部 adapter 或 runtime tool 只需要接这一条 contract。
- **可靠性 / 稳定性**：reference summary 现在不再只是“有名字但没有取回路径”；即使不提前注入正文，也能沿统一 contract 继续定位和获取。
- **安全性**：仍然坚持 deeper material 默认不全量注入 prompt，只有显式选中的正文才会进 prompt；其余 reference 通过 handle 按需取回，避免无节制扩 prompt。

### 对业务完整度的帮助

- **场景归属**：这是“人与 AI 协作层”的能力补全。
  - 人类作者：继续用 editor 绑定 skill / reference / phase / budget
  - AI 节点：现在除了拿摘要，还能拿到统一 retrieval handle，为后续 phase pipeline 按需取正文提供稳定入口
- **改动前**：skill reference 要么被作者静态选进 prompt，要么运行时完全不知道如何再取正文。
- **改动后**：Skill Catalog 已从“静态注入”推进到“静态注入 + 统一 retrieval contract + lazy-fetch-ready handle”。
- **为什么不算陷入细枝末节**：这轮没有继续把时间花在 callback 文案或 publish 细部 polish，而是沿 runtime-foundation 的 P1 主线补上 AI 协作层仍明显缺的 retrieval 能力基础设施。

## 当前仍欠缺的部分

- 真正的 **runtime-driven reference lazy fetch** 还没完全打通：
  - 当前主 AI 还没有在 phase pipeline 内自动触发 `skills.get_reference`
  - 这轮先补的是“统一 contract + prompt handle”，不是“planner/LLM 已自动发起 reference 请求”
- editor 的 `sensitive access policy` 入口仍是另一个更偏用户层 / 治理层的明显缺口。
- Team / Enterprise 的 `organization / workspace / member / role / publish governance` 仍未收口为最小领域模型。

## 文件解耦判断

- 本轮没有把 retrieval 逻辑继续堆回 `agent_runtime.py`，而是保持在 `skill_catalog.py` 内封装 service 边界。
- `skills.py` route 只新增薄层 `mcp/call` 入口，仍保持 route 薄、service 承担事实拼装的分层。
- `SkillPromptReference` 只增量补一个 `retrieval` 句柄，没有引入重型 runtime 对象或新的 skill 执行模型。

## 验证

- 局部测试：
  - `api/.venv/Scripts/uv.exe run pytest -q tests/test_skill_catalog_service.py tests/test_skill_routes.py tests/test_agent_runtime_llm_integration.py`
  - 结果：`12 passed`
- changed-files lint：
  - `api/.venv/Scripts/uv.exe run ruff check app/schemas/skill.py app/services/skill_catalog.py app/api/routes/skills.py tests/test_skill_catalog_service.py tests/test_skill_routes.py tests/test_agent_runtime_llm_integration.py`
  - 结果：通过
- 后端全量回归：
  - `api/.venv/Scripts/uv.exe run pytest -q`
  - 结果：`353 passed`
- 工作区 diff 检查：
  - `git diff --check`
  - 结果：仅有行尾风格提示，无语法或空白错误

## 下一步建议

1. **P1：把 retrieval handle 接到真正 runtime-driven 的 reference fetch**
   - 让 planner / phase pipeline 能在确有需要时触发 `skills.get_reference`，而不是只把 handle 暴露给 prompt。
2. **P1：补 editor 的 sensitive access policy 主入口**
   - 这是用户层和治理层之间仍较大的体验空缺。
3. **P2：收敛 Team / Enterprise 最小治理模型**
   - 尽快把 `organization / workspace / member / role / publish governance` 写成最小设计稿，避免后续产品叙事与实现继续漂移。

## 收尾说明

- 本轮没有触发人工界面设计通知脚本，因为项目仍未进入“只剩人工逐项界面验收”的阶段。
- 本轮已补齐代码、验证与文档留痕；随后按仓库约定做一次仅包含本轮相关文件的 Git 提交。
