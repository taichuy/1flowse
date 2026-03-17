# 2026-03-17 Skill phase binding and prompt budget

## 背景

- 按 `docs/dev/runtime-foundation.md` 当前优先级复核后，可以确认：callback waiting / approval / publish diagnostics 主链已经连续推进多轮，不再是“完全没有闭环”的状态。
- 当前更容易拖慢全局完整度的，是 AI 与人协作层里 `Skill Catalog` 仍停留在“静态 `skillIds` + 全量正文注入”的最小形态：
  - 人类虽然已经能在 editor 里挑选 `skillIds`，但还不能声明“哪个 phase 需要 skill”。
  - AI 虽然已经能拿到 `SkillDoc`，但还不能区分主正文与 deeper reference material，也没有 prompt budget 边界。
  - workflow / workspace starter 持久化校验只能验证 `skillIds` 是否存在，还不能 fail-fast 识别无效 reference 绑定。
- 用户本轮明确要求：不要长期陷在单一场景里做局部修补，要优先推进“用户层 / 人与 AI 协作层 / AI 治理层”的全局闭环。因此本轮没有继续只围绕 callback/publish 做细节打磨，而是转向 Skill Catalog 注入策略这条更能补 AI 协作层的主线。

## 目标

1. 给 `llm_agent` 增加最小可用的 phase-aware skill binding，而不引入第二套 DSL。
2. 让 selected reference body 保持 opt-in，不再默认全量进入 prompt。
3. 为 skill 正文 + selected reference body 增加近似 prompt budget 控制。
4. 把同一套 skill binding contract 同步到 workflow/workspace starter persistence guard 和 editor 配置入口。

## 实现

### 1. 后端 Skill 注入升级为 phase-aware

- `api/app/schemas/workflow_node_validation.py`
  - 新增 `config.skillBinding` 结构校验，支持：
    - `enabledPhases`
    - `promptBudgetChars`
    - `references[]`
  - 继续保持 `skillIds` 作为主绑定事实，不把 skill 设计成新节点类型。
- `api/app/services/agent_runtime.py`
  - 新增 phase-aware node input builder。
  - `main_plan / assistant_distill / main_finalize` 现在可按 phase 决定是否注入 `skill_context`。
  - selected reference body 只在命中的 phase 内进入 prompt。
- `api/app/services/agent_runtime_llm_assistant.py`
  - assistant distill 现在也能沿同一条 skill context 主链接收 phase-specific 注入，而不是永远与 skill 隔离。

### 2. Skill Catalog service 增加 selected reference body 与 budget 语义

- `api/app/services/skill_catalog.py`
  - `build_prompt_docs()` 新增：
    - `selected_reference_ids_by_skill`
    - `prompt_budget_chars`
  - `SkillPromptReference` 现在允许携带可选 `body`；未选中的 reference 仍只保留 summary。
  - budget 先作用于 skill 正文，再顺序作用于 selected reference body；预算不足时截断并加省略号。
  - 若配置了不存在的 reference，会直接抛出 `SkillCatalogError`，避免 runtime 静默吞掉错误。

### 3. Persistence guard 升级到 reference 级别

- `api/app/services/workflow_skill_references.py`
  - 除了已有的 `skillIds` 存在性校验，本轮继续校验：
    - `skillBinding.references[].skillId` 是否属于当前 `skillIds`
    - `skillBinding.references[].referenceId` 是否真实存在
- `api/app/services/workflow_definitions.py`
  - 新增 reference id index 入口，并接回 workflow / workspace starter 持久化校验主链。
- 这样 editor、workflow create/update、workspace starter create/update 会在保存前对无效 reference binding 直接 fail-fast。

### 4. 前端 editor 增加独立 binding strategy section

- `web/components/workflow-node-config-form/llm-agent-node-config-form.tsx`
  - 保持主表单为 orchestrator，只负责 state 组装。
- 新增 `web/components/workflow-node-config-form/llm-agent-skill-binding-section.tsx`
  - 提供 phase 选择
  - 提供 prompt budget 输入
  - 提供 selected reference body 绑定文本入口
  - 对输入格式错误给出即时反馈
  - 保持 skillId / referenceId 原样，不在 UI 侧擅自改写大小写；prompt budget 也支持从已填写值重新清空，避免作者只能新增不能回退
- 这让“人类作者如何把 service-hosted skill 绑定到具体 phase”有了明确入口，而不再需要只靠手写 JSON 或后端隐式约定。

## 为什么这轮值得做

### 对架构的帮助

- **扩展性**：skill 仍然挂在 `llm_agent` 的认知注入层，没有新建节点类型、第二套 runtime 或 SkillHub DSL。
- **兼容性**：`SkillDoc` / `SkillReferenceDoc` 的最小模型不变，REST catalog 仍是主事实；只是把注入策略往 phase 和 budget 上延伸。
- **可靠性 / 稳定性**：无效 reference binding 现在会在保存前或 runtime 构建 prompt doc 前显式失败，不再靠运行后人工排查“为什么 prompt 里没有 reference body”。
- **安全性**：selected reference body 改为 opt-in，避免未来 deeper material 默认无限制进入 prompt；budget 也为后续 prompt governance 提供了最小边界。

### 对业务完整度的帮助

- **场景归属**：这是“人与 AI 协作层”的功能，同时服务两类用户：
  - 人类作者：在 editor 中声明 skill 该在哪个 phase 注入、哪些 reference body 可以进入 prompt。
  - AI 节点：在不同 phase 获得不同粒度的认知材料，而不是永远吃同一份静态 skill context。
- **改动前**：只有 `skillIds`，没有 phase-aware binding、没有 reference body 选择、没有 prompt budget，workflow/workspace starter 也不能校验 reference binding。
- **改动后**：skill 注入从“有没有绑定”升级到“何时绑定、带哪些 deeper material、占多少预算”，并且前后端都能识别错误 binding。
- **为什么不算陷入细枝末节**：这不是继续美化已有 callback/publish 细节，而是在 AI 协作层补上一个原本明显缺口，使 editor、persistence guard 和 runtime 真正围绕同一条 `Skill Catalog -> binding -> phase injection` 主链闭合。

## 当前产品完整度判断（本轮后）

### 已完成到可持续推进的场景

- **用户层**
  - workflow editor 最小配置主链可用
  - publish panel / workspace starter / run detail 可持续迭代
  - `llm_agent` 已不再只有文本级 `skillIds`，而是有了显式 binding strategy 入口
- **人与 AI 协作层**
  - `llm_agent` phase pipeline、tool trace、evidence、run diagnostics 已是稳定事实
  - product skill 已从“静态 skillIds”推进到 phase-aware binding + selected reference body + prompt budget
- **AI 治理层**
  - sensitive access / approval / notification / callback waiting 主链继续成立
  - skill deeper material 不再默认全量注入，为后续 prompt governance 留出边界

### 仍明显欠缺的场景

- Skill Catalog 还没有 MCP retrieval contract。
- reference lazy fetch 还不是 runtime-driven：当前是“配置选定 body 再注入”，还不是“主 AI 运行时按需请求单个 reference 正文”。
- editor 仍缺 sensitive access policy 主入口与更完整 schema builder。
- Team / Enterprise 方向的 `organization / workspace / member / role / publish governance` 仍未收口为最小领域模型。

## 文件解耦判断

本轮有意识地按“职责/聚合/扩展/追踪”做了最小拆分，而不是只按行数拆：

- `llm-agent-node-config-form.tsx` 继续保留壳层职责；新增 `llm-agent-skill-binding-section.tsx` 承接 binding strategy UI，避免主表单继续吸收 phase/budget/reference 解析逻辑。
- `agent_runtime.py` 虽然仍是热点，但本轮没有把 skill 逻辑再堆成单次大判断，而是补成 phase helper，维持 orchestration owner 的定位。
- `workflow_skill_references.py` 把 skill reference guard 继续留在专门的 persistence validation helper，而不是把逻辑塞回 route 或 workflow definition 主服务。
- `WorkflowNodeSkillBindingPolicy` 的 reference merge 现在保留作者输入的 skill/reference id 大小写，避免 schema 归一化阶段把合法绑定误写成不存在的 catalog id。

## 验证

- 后端局部回归：
  - `api/.venv/Scripts/uv.exe run pytest -q tests/test_skill_catalog_service.py tests/test_agent_runtime_llm_integration.py tests/test_workflow_routes.py tests/test_workspace_starter_routes.py`
  - 结果：`95 passed`
- 后端全量回归：
  - `api/.venv/Scripts/uv.exe run pytest -q`
  - 结果：`352 passed`
- 后端 changed-files lint：
  - `api/.venv/Scripts/uv.exe run ruff check ...`
  - 结果：通过
- 前端类型与 lint：
  - `web/pnpm exec tsc --noEmit`
  - `web/pnpm lint`
  - 结果：通过

## 下一步建议

1. **P1：补 MCP retrieval contract 与 runtime-driven reference lazy fetch**
   - 现在 phase-aware binding 和 selected reference body 已经有主链，下一步应让主 AI 能在 phase pipeline 里按需请求单个 reference 正文，而不是继续把 deeper material 依赖静态配置。
2. **P1：补 editor 的 sensitive access policy 入口**
   - 这是用户层和治理层之间还比较大的空缺，优先级高于继续在 callback/publish 细部做解释优化。
3. **P2：收敛 Team / Enterprise 最小领域模型**
   - 尽快把 `organization / workspace / member / role / publish governance` 形成最小设计稿，避免后续对外叙事和内核实现再混线。

## 收尾说明

- 本轮没有触发人工界面设计通知脚本，因为项目仍未进入“只剩人工逐项界面验收”的阶段。
- 本轮已补齐代码、验证与文档留痕；随后按仓库协作约定执行一次只包含本轮相关文件的 Git 提交。
