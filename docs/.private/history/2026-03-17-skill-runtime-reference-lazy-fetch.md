# 2026-03-17 Skill runtime reference lazy fetch

## 背景

- 最近一次提交 `d0b77ae feat: add skill catalog mcp retrieval contract` 已把 Skill Catalog 的 REST / MCP retrieval contract 和 prompt-level retrieval handle 补齐，但 `llm_agent` 运行时仍主要依赖作者预先勾选 reference body。
- `docs/dev/runtime-foundation.md` 把下一步优先级明确收敛到：让 planner / phase pipeline 真正接到 runtime-driven 的 reference lazy fetch，而不是继续停留在“模型只能看到 handle，但运行时不会真正拉正文”的半闭环状态。
- 从“用户层 / 人与 AI 协作层 / AI 治理层”的三层视角看，当前最明显的缺口已经不再是 callback 文案细修，而是 AI 协作层里 skill 仍偏静态注入，没能让主 AI 在运行时按当前上下文补齐更深材料。

## 目标

1. 让 `llm_agent` 在 `main_plan / assistant_distill / main_finalize` phase 内，能基于当前上下文自动补拉最相关的 skill reference body。
2. 保持 `SkillDoc` 仍是 service-hosted 的轻量认知注入层，不引入新的节点类型、SkillHub、本地下载中心或客户端接管逻辑。
3. 让这条 lazy fetch 主线有运行时留痕，而不是只在 prompt 里静默塞正文。

## 实现

### 1. `SkillCatalogService` 增加 reference suggestion helper

- 文件：`api/app/services/skill_catalog.py`
- 新增 `suggest_reference_ids()`：
  - 基于 query token 与 `reference.name / description` 的匹配分数，为每个 skill 选择最相关的 reference。
  - 默认跳过已显式选中的 reference，避免把静态绑定和 runtime lazy fetch 混成重复注入。
  - 当前每个 skill 默认只补一个最相关 reference，保持 prompt budget 和行为边界都比较克制。

### 2. `AgentRuntime` 把 lazy fetch 接到 phase pipeline

- 文件：`api/app/services/agent_runtime.py`
- 新增 phase query helper：
  - `main_plan` 用 `goal / prompt / systemPrompt / node_input`
  - `assistant_distill / main_finalize` 额外吸收 `plan.analysis / tool summaries / evidence summary`
- `_resolve_skill_context()` 现在会：
  - 先取作者显式选中的 references
  - 再让 `SkillCatalogService.suggest_reference_ids()` 给出 runtime candidate
  - 合并后复用 `build_prompt_docs()` 统一做 prompt budget 裁剪
- 只有真正被内联进 prompt 的 lazy reference，才会继续往下暴露为运行时已加载结果。

### 3. 增加运行时事件留痕

- 当 runtime 确实内联了 lazy-fetched reference body，会额外写入：
  - `agent.skill.references.loaded`
- 事件 payload 会带：
  - `node_id`
  - `phase`
  - `references[{ skill_id, reference_id }]`
- 这样 run trace、AI 调用记录和后续排障可以回答：“这次 skill reference 是作者手选的，还是运行时按上下文补拉的。”

## 对产品目标的帮助

### 场景归属

- 这轮主要补的是“人与 AI 协作层”。
- 人类作者仍负责：
  - 绑定 skill
  - 约束 enabled phases
  - 控制 prompt budget
  - 显式选中必须内联的 references
- AI 节点现在额外获得：
  - 基于当前 phase 上下文补拉一段最相关 reference 正文的运行时能力

### 闭环推进

- 改动前：runtime 只能把 selected reference body 静态塞进 prompt；未选中的 reference 只有摘要和 retrieval handle。
- 改动后：runtime 已经能沿 phase pipeline 把“摘要 + handle”推进到“摘要 + handle + 基于当前上下文自动补拉一段最相关正文”。
- 这让 Skill Catalog 从“静态配置增强”更进一步推进到“运行时协作增强”，更贴近产品设计里“云端 Skill 指导本地助手执行”的真实使用链路。

## 架构判断

- 这轮没有把 retrieval 逻辑塞回 `LLMProvider` 或 `ToolGateway`，而是继续保持：
  - `SkillCatalogService` 负责 catalog / retrieval / suggestion
  - `AgentRuntime` 负责 phase orchestration 与什么时候取 skill context
- 没有引入新的 runtime、第二套 DSL、第二套 skill 执行语义，也没有突破 OpenClaw / 本地助手的职责边界。

## 文件解耦判断

- 本轮没有做额外拆分，但 `api/app/services/agent_runtime.py` 已继续接近“phase orchestration + helper facade”的角色。
- 当前 `agent_runtime.py` 约 700 行，虽然未触发强制拆分阈值，但已经出现：
  - phase orchestration
  - skill context 组装
  - lazy fetch query 构造
  - fallback / checkpoint / event 辅助
  的聚合趋势。
- 如果后续继续补“模型主动发起多轮 reference retrieval”或更复杂的 skill fetch policy，应优先把 skill-runtime helper 继续下沉到独立模块，而不是让 `agent_runtime.py` 继续横向扩张。

## 验证

- 局部测试：
  - `api/.venv/Scripts/uv.exe run pytest -q tests/test_skill_catalog_service.py tests/test_agent_runtime_llm_integration.py`
  - 结果：`13 passed`
- changed-files lint：
  - `api/.venv/Scripts/uv.exe run ruff check app/services/skill_catalog.py app/services/agent_runtime.py tests/test_skill_catalog_service.py tests/test_agent_runtime_llm_integration.py`
  - 结果：通过
- 后端全量回归：
  - `api/.venv/Scripts/uv.exe run pytest -q`
  - 结果：`355 passed`

## 当前仍未完成的部分

- 当前是 **runtime-driven heuristic lazy fetch**，不是“模型显式发起 MCP retrieval 调用”的完整闭环。
- 运行时目前仍是“每个 skill 默认挑一个最相关 reference”这类克制策略，尚未支持：
  - 多轮 retrieval
  - phase 内连续 fetch / re-rank
  - 更细粒度的 fetch reason explainability
  - 真正的 model-issued `skills.get_reference` action
- editor 的 `sensitive access policy` 主入口仍是用户层 / AI 治理层之间更大的待补缺口。

## 下一步建议

1. **P1：把 lazy fetch 从 heuristic 推进到 model-issued retrieval**
   - 让主 AI 在 phase 内显式请求 `skills.get_reference`，而不只是让 runtime 做一次最佳匹配。
2. **P1：补 workflow editor 的 sensitive access policy 主入口**
   - 让用户层真正能在设计态 author 治理约束，而不只是运行后再看治理结果。
3. **P2：继续治理 `agent_runtime.py` 的 skill/runtime helper 聚合**
   - 若 skill retrieval 再扩一轮，应优先抽到独立 helper/service，避免 phase orchestrator 重新长回热点文件。
