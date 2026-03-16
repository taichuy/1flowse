# 2026-03-16 架构与交付承载度复核

## 背景

- 用户要求重新阅读 `AGENTS.md`、`docs/dev/user-preferences.md`、`docs/product-design.md`、`docs/technical-design-supplement.md`、`docs/open-source-commercial-strategy.md` 与 `docs/dev/runtime-foundation.md`，并结合当前代码判断：基础框架是否已经写好、是否满足持续功能开发、插件扩展性、兼容性、可靠性、稳定性、安全性，以及哪些代码热点需要继续解耦。
- 本轮目标是给出“是否可以继续沿主线做功能闭环”的结论，并把当前优先级与验证结果留成可追溯事实。

## 复核范围

- 文档：`AGENTS.md`、`docs/dev/user-preferences.md`、`docs/product-design.md`、`docs/technical-design-supplement.md`、`docs/open-source-commercial-strategy.md`、`docs/dev/runtime-foundation.md`
- 后端抽查：`api/app/main.py`、`api/app/api/routes/workflows.py`、`api/app/services/runtime.py`、`api/app/services/agent_runtime.py`、`api/app/services/plugin_runtime.py`、`api/app/services/published_gateway.py`、`api/app/services/sensitive_access_control.py`
- 前端抽查：`web/app/page.tsx`、`web/components/workflow-editor-workbench.tsx`、`web/lib/get-workflow-publish.ts`、`web/lib/workflow-tool-execution-validation.ts`、`web/components/workflow-editor-variable-form.tsx`
- 验证：`cd api; .\.venv\Scripts\uv.exe run pytest -q`、`cd web; pnpm exec tsc --noEmit`、`cd web; pnpm lint`

## 结论

### 1. 基础框架已经足够承接持续功能开发

- 当前后端已经形成 `workflow definition/version -> compiled blueprint -> runtime -> run/node_run/run_events -> published surface -> diagnostics` 的统一主链，不需要回头重搭执行骨架。
- `RuntimeService`、`PublishedEndpointGatewayService`、`SensitiveAccessControlService`、`AgentRuntime` 与 workflow mutation/validation 相关 service 虽然仍在演进，但职责边界已经基本成型，说明系统不是靠单体脚本硬撑。
- 前端也不再是单页展示层：首页工作台、workflow editor、publish、workspace starter、sensitive access inbox 都已经接到真实 API，可继续围绕真实产品链路推进。

### 2. 扩展性、兼容性与治理方向总体成立

- 内部事实模型仍由 `7Flows IR`、runtime records 与 `run_events` 主导；Dify 兼容、OpenAI / Anthropic published surface 与 plugin adapter 都是在外围映射，没有反向控制内部执行语义。
- 插件扩展与发布兼容的方向是对的，但 execution capability 仍要继续兑现成更完整的 capability-driven / fail-closed 语义，避免高风险路径长期停留在“文档已定义、实际仍偏轻执行”的过渡态。
- 敏感访问控制、审批票据、通知分发、published detail access、trace export gating 都已进入统一主链，安全与治理不再只是外围补丁能力。

### 3. 可靠性、稳定性与安全性已具备继续推进的事实基础

- 后端验证：`300 passed in 34.41s`
- 前端验证：`pnpm exec tsc --noEmit` 通过；`pnpm lint` 通过且无 ESLint 错误
- 当前判断应表述为“具备继续开发和持续补闭环的稳定基础”，而不是“目标设计已经全部完成”；loop、sandbox backend、组织治理与更完整的 policy explanation 仍在后续优先级中。

### 4. 三层业务闭环可以继续推进，但还没到只剩界面设计阶段

- 用户层：已有 workflow editor、publish、workspace starter、首页 diagnostics 与 operator inbox，最小操作面已成立。
- AI 与人协作层：已有 run detail、trace export、callback waiting lifecycle、approval timeline、published invocation detail 等共享事实入口。
- AI 治理层：credential / context / tool / published detail access 已纳入统一 sensitive access 主链。
- 因此当前项目仍应优先做主链闭环与热点解耦，不触发“项目已完善，只剩人工逐项界面设计”的通知脚本。

## 当前热点

- 后端重点热点：`api/app/services/workspace_starter_templates.py`、`api/app/services/runtime_node_dispatch_support.py`、`api/app/services/agent_runtime.py`、`api/app/services/run_trace_views.py`
- 前端重点热点：`web/lib/get-workflow-publish.ts`、`web/lib/workflow-tool-execution-validation.ts`、`web/components/workflow-editor-variable-form.tsx`
- 当前判断不是“这些文件已经失控必须停工大拆”，而是“它们已经进入持续功能开发时需要优先下沉 helper / hook / presenter 的热点名单”，否则后续 waiting、publish diagnostics、policy explanation、editor advanced form 很容易把复杂度重新堆回去。

## 优先级建议

1. **P0：继续兑现高风险 execution capability 的 fail-closed 语义**
   - 把高风险 tool/plugin 路径从“execution-aware”继续推进到“真正 capability-driven”。
2. **P0：继续补齐 `WAITING_CALLBACK` 自动唤醒与 operator 续跑闭环**
   - 这是最直接影响真实流程完成度和运维体验的运行时短板。
3. **P0：继续扩统一 sensitive access 主链的 explanation 与 diagnostics**
   - 让审批、通知、trace、publish detail 与 run detail 的 operator 叙事更连贯。
4. **P1：继续治理 service / hook / data aggregation 热点**
   - 优先盯防上述长文件，避免复杂度重新聚回单点模块。
5. **P1：继续提高 editor / publish / skill catalog 的产品完整度**
   - 保持“前端可配置、后端诚实阻断、运行追溯统一落库”的方向。

## 影响

- `docs/dev/runtime-foundation.md` 需要同步刷新最近一次复核结论、验证结果与最新提交锚点。
- 当前项目策略仍是“继续沿既有 runtime / publish / diagnostics / editor / governance 主链推进”，不建议回头重搭基础框架。
