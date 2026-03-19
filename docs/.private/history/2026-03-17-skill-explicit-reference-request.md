# 2026-03-17 Skill explicit reference request

## 背景

- `SkillDoc`、REST catalog、`skills.get_reference` MCP retrieval contract、phase-aware lazy fetch，以及 execution diagnostics 对 loaded references 的 trace 已经落地。
- 但在这轮之前，Skill Catalog 仍主要停留在“runtime 自己按 query heuristic 自动补一段正文”的阶段：operator 虽然能看到事后加载了什么，却还不能回答“这是不是主 AI 自己判断需要的材料”。
- `docs/dev/runtime-foundation.md` 已把 `P1 Skill Catalog` 的下一步收敛到：让主 AI 在确有需要时显式发起单个 `skills.get_reference` 请求，并补更细粒度的 fetch reason / multi-fetch trace。

## 目标

1. 让 `llm_agent` 的 `main_plan` phase 可以显式请求单个 skill reference 正文，而不是只依赖 heuristic lazy fetch。
2. 保持 `SkillDoc` 仍是 service-hosted 的轻量认知注入层，不引入新的 runtime、第二套 DSL 或客户端接管式 skill runtime。
3. 把这次显式请求的 reason / request round / loaded result 写回统一事实层，并让 operator 在 execution view 直接看到。

## 实现

### 1. `main_plan` 增加显式 reference request 语义

- 文件：`api/app/services/agent_runtime_llm_plan.py`
- 规划 prompt 现在会在存在未内联 skill reference handle 时，允许模型使用前缀行：
  - `SKILL_REFERENCE_REQUEST {"skill_id":"...","reference_id":"...","reason":"..."}`
- `AgentPlan` 增加临时 `skill_reference_request` 字段，用于承接这次 phase 内的显式请求。
- 这保持了原有 LLM plan 输出的兼容性：没有该前缀时，仍按普通 analysis 文本处理。

### 2. runtime 按 `selected > explicit request > heuristic match` 重建 skill context

- 文件：`api/app/services/agent_runtime.py`
- `_resolve_skill_context()` 改为统一维护 reference load specs，而不是只合并 “selected ids + lazy ids”。
- 显式请求成功时：
  - runtime 会校验 `skillIds` 绑定范围；
  - 校验 reference 是否存在；
  - 重新构建 skill context，并让显式请求的 reference 在 prompt budget 里优先于 heuristic match。
- 如果请求无效、已加载，或因为 budget 未真正内联，也会诚实地产生结构化 request event，而不是静默成功。

### 3. 补 request / loaded trace 与 fetch reason

- 文件：`api/app/services/agent_runtime.py`
- 新增事件：
  - `agent.skill.references.requested`
- 现有事件 `agent.skill.references.loaded` 新增可选 metadata：
  - `fetch_reason`
  - `fetch_request_index`
  - `fetch_request_total`
- heuristic lazy fetch 现在也会带上更具体的 query match reason，而不再只是笼统的 `retrieval_query_match`。

### 4. execution view / node card 直接展示 reason 与 request round

- 文件：
  - `api/app/schemas/run_views.py`
  - `api/app/services/run_execution_views.py`
  - `web/lib/get-run-views.ts`
  - `web/components/run-diagnostics-execution/execution-node-card-sections.tsx`
- execution node card 的 `Skill references` section 现在会直接展示：
  - load source
  - fetch reason
  - request round
  - retrieval handle

### 5. 顺手补基础能力细节

- 文件：`api/app/services/skill_catalog.py`
- `suggest_references()` 现在返回结构化 suggestion item，而不是只有 reference id。
- `build_prompt_docs()` 现在尊重调用方给出的 selected reference 顺序，避免显式请求或手工绑定在 prompt budget 内被字母序抢走优先级。

## 影响范围

### 用户层

- 作者暂时不需要新增 UI 配置，仍通过 `skillIds` / `skillBinding` 使用 Skill Catalog。
- operator 在 run execution diagnostics 里能更直接看出：“这是绑定正文、heuristic 补拉，还是模型显式请求”。

### AI 与人协作层

- Skill Catalog 从“AI 能看到 handle，runtime 也许帮它补一段”推进到“主 AI 可显式说出自己需要哪段正文”。
- 这让 AI 的材料请求更接近可解释行为，而不是完全靠 runtime 猜测。

### AI 治理层

- 仍保持单次、单 reference、service-hosted 的收敛边界。
- 没有引入第二套调度、第二套节点语义或本地下载式 skill runtime。

## 验证

- 后端局部测试：
  - `api/.venv/Scripts/uv.exe run pytest -q tests/test_skill_catalog_service.py tests/test_agent_runtime_llm_integration.py tests/test_run_view_routes.py`
- 后端全量测试：
  - `api/.venv/Scripts/uv.exe run pytest -q`
- 后端静态检查：
  - `api/.venv/Scripts/uv.exe run ruff check app/services/runtime_types.py app/services/skill_catalog.py app/services/agent_runtime_llm_plan.py app/services/agent_runtime.py app/services/run_execution_views.py app/schemas/run_views.py tests/test_skill_catalog_service.py tests/test_agent_runtime_llm_integration.py tests/test_run_view_routes.py`
- 前端验证：
  - `web/pnpm exec tsc --noEmit`
  - `web/pnpm lint`
- diff 检查：
  - `git diff --check`

结果：上述命令全部通过；`git diff --check` 仅提示仓库既有的 LF/CRLF 工作树警告，无新增 diff 格式错误。

## 未决与下一步

1. 当前显式 request 只接到了 `main_plan`，`main_finalize / assistant_distill` 仍主要依赖 heuristic lazy fetch。
2. `agent.skill.references.requested` 已进入 `run_events`，但 published invocation detail 还没有同级别的 request / reason drilldown。
3. 当前仍限制为单次、单 reference request；如果后续要继续推进 multi-fetch，优先复用这轮的 `request_index / request_total` 语义扩展，而不是另起一套 trace 模型。
