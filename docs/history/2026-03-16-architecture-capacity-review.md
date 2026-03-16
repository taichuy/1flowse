# 2026-03-16 架构承载能力与后续闭环评估

## 背景

- 用户要求基于 `AGENTS.md`、产品/技术/开源策略基线、用户偏好与 `docs/dev/runtime-foundation.md`，重新判断当前项目是否已经把基础框架设计到可持续推进阶段。
- 本轮重点不是新增功能，而是回答五类问题：基础框架是否已写好、是否足以承接后续功能/插件/兼容/稳定性/安全、是否存在需要继续解耦的长文件热点、主业务闭环是否已具备持续推进条件，以及下一步应如何按优先级推进。

## 评估输入

- 文档基线：`AGENTS.md`、`docs/product-design.md`、`docs/technical-design-supplement.md`、`docs/open-source-commercial-strategy.md`、`docs/dev/runtime-foundation.md`、`docs/dev/user-preferences.md`
- 代码抽查：`api/app/services/runtime.py`、`api/app/services/agent_runtime.py`、`api/app/services/tool_gateway.py`、`api/app/services/workflow_definitions.py`、`api/app/api/routes/workflows.py`、`web/components/workflow-editor-workbench.tsx`、`web/components/sensitive-access-inbox-panel.tsx`
- 体量热点盘点：对 `api/`、`web/` 按行数排序复核当前长文件与主热点分布
- 提交脉络：最近提交 `b487b8d refactor: split sensitive access inbox panel`、`9a28aec docs: align project status follow-up review`、`18795bc docs: validate architecture status review`

## 结论

### 1. 基础框架已经足够支撑持续功能开发

- 当前项目不再是“骨架未定”的阶段；`workflow version -> compiled blueprint -> runtime -> run/node_run/run_events -> published surface -> run diagnostics` 的主链已经成立。
- 后端主执行入口虽然仍集中在 `RuntimeService`，但节点准备、节点分发、执行进度、生命周期、图调度已通过 mixin 拆开，没有继续堆回单体 God object。
- `tool`、`llm_agent`、runtime execution adapter、published surface、sensitive access、workspace starter、workflow editor 之间已经存在相对稳定的边界，说明后续开发可以围绕主业务闭环继续推进，而不是先返工重搭底座。

### 2. 架构已经满足“功能开发 / 插件扩展 / 兼容性演进”的最低门槛

- 内部事实仍以 `7Flows IR`、workflow schema、runtime records 和 `run_events` 为中心，没有被 OpenAI / Anthropic / Dify 某一外部协议反向主导。
- Dify 兼容方向主要通过 plugin runtime / compat adapter 演进，published surface 已拆成 native / OpenAI / Anthropic 多协议映射，整体仍符合“内部统一、对外适配”的设计方向。
- workflow definition persistence 已叠加 schema 校验、tool catalog reference guard、tool execution capability guard、publish version reference guard、planned node guard，说明“可保存”和“可运行”的边界正在变得诚实，不再只靠 UI 文案提醒。
- 仍需注意：真正的 `SandboxBackendRegistration / SandboxExecution` 还未落地，`loop` 仍未进入 MVP executor，这两项决定了架构虽然可扩展，但还没有达到“核心边界全兑现”的阶段。

### 3. 可靠性 / 稳定性 / 安全已具备继续强化的事实基础

- `SensitiveAccessControlService`、`ApprovalTicket`、`NotificationDispatch`、tool invoke gating、published invocation detail access、trace export gating 已形成统一事实层，说明安全治理不是零散附加逻辑。
- waiting / resume / callback ticket / artifact store / trace export / published invocation audit 已具备稳定演进的事实源，后续可以继续做 operator experience 与自动唤醒，而不是重做状态模型。
- `300 passed` 的后端测试与通过的前端 `tsc --noEmit` 说明当前项目具备可持续迭代的基本稳定性；但这不等于业务闭环全部完成，只代表主链在现有范围内没有明显失稳。

### 4. 当前最主要的风险是“热点持续膨胀”，不是“骨架方向错误”

- 后端热点集中在 `workspace_starter_templates.py`、`runtime_node_dispatch_support.py`、`agent_runtime.py`、`workflow_library_catalog.py`、`runtime_run_support.py`、`sensitive_access_control.py`、`notification_delivery.py`、`run_callback_ticket_cleanup.py`、`run_trace_views.py`。
- 前端热点集中在 `get-workflow-publish.ts`、`workflow-tool-execution-validation.ts`、`workflow-editor-variable-form.tsx` 等配置/校验聚合文件。
- 这些文件长度本身还没到必须立即重写的程度，但如果继续叠加 waiting policy、provider-specific 分支、starter governance、publish diagnostics 或变量/publish 表单逻辑而不下沉 helper，会再次回到“单文件吸职责”的状态。

### 5. 主要业务可以继续推进，但还没有到“人工逐项界面设计验收”阶段

- 用户层：workflow editor、run diagnostics、publish governance、sensitive access inbox 已具备工作台雏形，但 editor 的字段级配置完整度、publish binding identity、callback waiting operator 体验仍需继续补齐。
- AI 与人协作层：`llm_agent` phase pipeline、tool execution trace、run evidence / execution view 已能支撑协作与排障，但 product-level skill catalog、更完整的 publish / callback / approval narrative 还未闭环。
- AI 治理层：敏感访问控制、审批与通知事实层已经成型，是当前最接近产品设计要求的一条治理主线；不过组织级 role/workspace/governance 仍主要停留在目标设计。
- 因此当前判断是：可以持续推进主业务完整度，并逐步形成闭环；但尚未达到“所有核心功能都已完成，只剩人工逐项界面设计”的成熟阶段，所以本轮不触发通知脚本。

## 优先级建议

1. **P0：补齐 waiting / callback 唤醒闭环与 operator 续跑体验**
   - 这是最直接影响“流程可完成性”的运行时缺口，优先级高于再做更多外围展示。
2. **P0：把 graded execution 继续推进到真实隔离后端**
   - 现有 execution-aware contract 已成立，但真正的 sandbox / microvm backend 仍未兑现，是可靠性与安全性的关键缺口。
3. **P0：继续扩统一敏感访问控制闭环**
   - 当前事实层已经具备，应继续把 policy explanation、operator diagnostics、approval timeline 与 publish / trace drilldown 做完整。
4. **P1：继续治理 runtime / publish / diagnostics 热点文件**
   - 特别是 `runtime_node_dispatch_support.py`、`agent_runtime.py`、`run_trace_views.py`、`get-workflow-publish.ts`、`workflow-editor-variable-form.tsx`。
5. **P1：继续提高 editor 与 publish 的结构化配置完整度**
   - 保持“人可配置、AI 可追溯、保存链路诚实阻断”的方向，不要退回大块 JSON 编辑。
6. **P1：收敛轻量 Skill Catalog 与注入链**
   - 这条线会决定后续 AI 协作层能否真正接近产品设计目标，但仍应保持轻量 service-hosted 方案，不做重型 SkillHub。
7. **P2：补最小组织治理模型**
   - 为 Team / Enterprise 留治理位，但不提前引入重 IAM 或第二套执行核心。

## 验证

- 后端：`cd api; .\.venv\Scripts\uv.exe run pytest -q` → `300 passed`
- 前端：`cd web; pnpm exec tsc --noEmit` → 通过（零输出）
- 代码体量盘点：已按 `api/`、`web/` 全量文件行数排序复核主热点

## 后续影响

- `docs/dev/runtime-foundation.md` 需要同步把这轮“基础框架已可承接持续开发，但仍未进入人工验收阶段”的判断写成当前事实。
- 后续若继续出现“热点回流主文件”的趋势，应优先做结构治理，而不是继续只补功能。
