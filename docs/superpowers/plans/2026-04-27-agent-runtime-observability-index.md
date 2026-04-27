# Agent Runtime Observability 1+n Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 2026-04-27 两份 Agent Runtime 可观测设计文档拆成 `1 个索引 + 7 个独立子计划`，每个子计划都能独立执行、测试和提交。

**Architecture:** 总索引负责锁定全局边界、依赖顺序、验收矩阵和讨论覆盖；子计划按事实主干、provider streaming、agent/capability/context、模型目录与容灾、gateway billing、external/isolation、debug read model 七条主干拆分。所有实现先 shadow-write，不破坏现有 `flow_runs / node_runs / flow_run_events / ApplicationRunDetail` 调试链路。

**Tech Stack:** Rust 2021、Axum、Tokio、SQLx/PostgreSQL、Serde、UUID v7、React 19、TypeScript、TanStack Query、Vitest

---

## Design Sources

- `docs/superpowers/specs/2026-04-27-agent-runtime-capability-observability-design.md`
- `docs/superpowers/specs/2026-04-27-agent-runtime-observability-evaluation-addendum.md`

## Execution Plans

1. [Runtime Fact Spine](./2026-04-27-agent-runtime-observability-01-runtime-fact-spine.md)
   建立 `RuntimeSpan / RuntimeEvent / RuntimeItem / artifact / audit hash` 事实层，兼容旧 `flow_run_events`。
2. [Provider Streaming Spine](./2026-04-27-agent-runtime-observability-02-provider-streaming-spine.md)
   把 provider runtime 从 `wait_with_output()` 升级到 stdio v2 NDJSON streaming，并接入 event bus、delta coalescing、durable writer。
3. [Agent Session Capability Context](./2026-04-27-agent-runtime-observability-03-agent-session-capability-context.md)
   落 `ContextProjection` 两阶段、LLM turn loop、CapabilityCatalog、skill/MCP/workflow/approval/subagent 事实。
4. [Model Catalog Routing Failover](./2026-04-27-agent-runtime-observability-04-model-catalog-routing-failover.md)
   落模型供应商目录、LLM 节点一线合同、容灾队列、attempt ledger 和 `LlmNodeOutputs`。
5. [Gateway Billing Audit](./2026-04-27-agent-runtime-observability-05-gateway-billing-audit.md)
   落 OpenAI-compatible gateway 事实、billing session、usage/cost/credit、account pool、fail-safe 和防篡改审计。
6. [External Bridge Isolation](./2026-04-27-agent-runtime-observability-06-external-bridge-isolation.md)
   落外部 agent observed-facts-only、telemetry bridge 可信等级、插件运行时隔离矩阵和 system_agent 边界。
7. [Debug Read Model UI](./2026-04-27-agent-runtime-observability-07-debug-read-model-ui.md)
   落 span tree、debug stream part、读 API、前端映射和外部可信等级展示。

## Required Execution Order

- [ ] **Step 1: Execute Runtime Fact Spine**

Plan:

```text
docs/superpowers/plans/2026-04-27-agent-runtime-observability-01-runtime-fact-spine.md
```

Why first:

1. 后续所有主干都要写 `runtime_spans / runtime_events / runtime_items / runtime_artifacts`。
2. 旧调试链路必须先有 shadow-write 兼容策略。

- [ ] **Step 2: Execute Provider Streaming Spine**

Plan:

```text
docs/superpowers/plans/2026-04-27-agent-runtime-observability-02-provider-streaming-spine.md
```

Why second:

1. `provider_contract.rs` 已有 `ProviderStreamEvent` 雏形，但 `plugin-runner` 仍是 `wait_with_output()`。
2. 只有 provider raw stream 实时进入 fact spine，SSE/blocking/debug fold 才有共同事实源。

- [ ] **Step 3: Execute Agent Session Capability Context**

Plan:

```text
docs/superpowers/plans/2026-04-27-agent-runtime-observability-03-agent-session-capability-context.md
```

Why third:

1. `LLM -> tool -> message -> LLM` 必须由 host runtime 管，而不是 provider plugin 管。
2. ContextProjection 是证明模型真实输入的 P0，不应等待 UI。

- [ ] **Step 4: Execute Model Catalog Routing Failover**

Plan:

```text
docs/superpowers/plans/2026-04-27-agent-runtime-observability-04-model-catalog-routing-failover.md
```

Why fourth:

1. LLM 节点需要稳定的一线合同才能驱动固定模型或容灾队列。
2. attempt ledger 是 usage/cost 归因和容灾复盘的前置。

- [ ] **Step 5: Execute Gateway Billing Audit**

Plan:

```text
docs/superpowers/plans/2026-04-27-agent-runtime-observability-05-gateway-billing-audit.md
```

Why fifth:

1. gateway 商业模式需要 billing session 和幂等边界。
2. usage/cost/credit/audit hash 要在一条事实主干上对账。

- [ ] **Step 6: Execute External Bridge Isolation**

Plan:

```text
docs/superpowers/plans/2026-04-27-agent-runtime-observability-06-external-bridge-isolation.md
```

Why sixth:

1. 外部 agent 不能被包装成完整可控事实。
2. 插件隔离、bridge 可信等级和 system_agent 身份要在运行时边界上落地。

- [ ] **Step 7: Execute Debug Read Model UI**

Plan:

```text
docs/superpowers/plans/2026-04-27-agent-runtime-observability-07-debug-read-model-ui.md
```

Why last:

1. UI 不应直接消费 provider raw delta。
2. 前端要从 `RuntimeItem + DebugStreamPart` 派生展示，且保留 `trust_level`。

## Coverage Matrix

| 讨论内容 | 子计划 |
| --- | --- |
| 当前源码状态：`provider_contract.rs` 有 stream event 雏形、`plugin-runner` 仍 `wait_with_output()`、SSE 仍轮询 detail | 01, 02, 07 |
| 产品形态：托管 agent、本地 agent 模型入口、system agent、中转站 | 03, 05, 06 |
| Dify 启发：tool 多来源、多形态结果、workflow-as-tool | 03 |
| n8n 启发：tool call 变 host engine request | 03 |
| AionRS/Codex/OpenClaw 启发：skill、compaction、subagent、外部 agent opaque | 03, 06 |
| OpenAI Agents JS 吸收：RunItem、HITL、RunState、compaction、agent-as-tool/handoff、stream part | 03, 07 |
| RuntimeSpan / RuntimeEvent / RuntimeItem | 01, 07 |
| append-only artifact、audit hash、防篡改 | 01, 05 |
| 旧 `flow_run_events` 兼容迁移 | 01 |
| runtime event bus、durable writer、delta 合并 | 02 |
| provider stdio v2 NDJSON streaming | 02 |
| provider 插件只产出模型事件和能力意图 | 02, 03, 06 |
| ContextProjection 两阶段、model_input_hash | 03 |
| compaction、summary artifact、projection proof | 03 |
| host-owned capability loop | 03 |
| CapabilityCatalog / CapabilityInvocation | 03 |
| skill index/load/snapshot/action | 03 |
| MCP tools/resources/prompts 边界 | 03 |
| workflow-as-tool 暂停/恢复/审批边界 | 03 |
| subagent / agent-as-tool / handoff | 03 |
| ModelProviderCatalogSource / relay sync | 04 |
| LLM node fixed model / failover queue | 04 |
| ModelFailoverAttemptLedger | 04 |
| LlmNodeOutputs / VariablePool 写回 | 04 |
| gateway raw model mode / agent-as-model mode | 05 |
| unified protocol facts | 05 |
| BillingSession / Idempotency | 05 |
| UsageLedger / CostLedger / CreditLedger | 05 |
| ProviderAccountPool | 05 |
| retry/fallback/cache billing/fail-safe/rate limit | 05 |
| usage/cost 缺失不估算扣费，billable path fail closed | 05 |
| external agent observed-facts-only | 06 |
| telemetry bridge trust levels | 06 |
| plugin permission isolation matrix | 06 |
| system_agent 触发器、身份、审批边界 | 06 |
| DebugStreamPart / Span Tree / timeline / ledger views | 07 |
| AI SDK UI stream adapter only optional | 07 |
| 外部 API：固定 host routes，插件不注册 HTTP route | 05, 06, 07 |
| 验收问题：模型、provider、upstream account、token、cache、credit、attempt、tool/MCP/skill、projection、subagent、opaque | 01-07 |

## Locked Decisions

- [ ] **Step 1: Preserve compatibility**

Every child plan must keep existing application runtime routes working:

```text
GET  /api/console/applications/{id}/logs/runs/{run_id}
POST /api/console/applications/{id}/orchestration/debug-runs
POST /api/console/applications/{id}/orchestration/debug-runs/stream
```

Expected:

1. Existing `ApplicationRunDetail` response shape remains valid.
2. New facts are written beside old records until plan 07 switches debug reads.

- [ ] **Step 2: Keep provider boundary narrow**

Provider plugins may:

```text
validate provider config
list models
invoke upstream model
emit ProviderStreamEvent / ProviderRuntimeLine
```

Provider plugins must not:

```text
execute host tools
connect MCP directly
load skill body
write run state
register HTTP routes
debit credit
```

- [ ] **Step 3: Keep external agent audit honest**

Raw gateway mode records:

```text
gateway request/response
model tool call messages
route/attempt/usage/cost/error
client-returned tool result messages
```

Raw gateway mode does not claim:

```text
external local shell/tool/MCP/skill/subagent facts
```

Those facts are `external_opaque` unless they pass through signed bridge telemetry.

## Final Verification

- [ ] **Step 1: Backend verification**

Run after all child plans:

```bash
cargo test -p domain runtime_observability
cargo test -p observability
cargo test -p storage-postgres orchestration_runtime_repository
cargo test -p control-plane orchestration_runtime
cargo test -p plugin-runner provider_stdio_v2
cargo test -p publish-gateway billing_session
cargo test -p api-server application_runtime_routes
```

Expected: PASS.

- [ ] **Step 2: Frontend verification**

Run after plan 07:

```bash
pnpm --dir web/packages/api-client test
pnpm --dir web/app test -- src/features/applications/_tests/runtime-observability/*
pnpm --dir web/app test -- src/features/agent-flow/_tests/debug-console/*
```

Expected: PASS.

## Self-Review

- Spec coverage: 设计稿 1-23 节和评估附录 P0/P1 都映射到 7 个子计划。
- Scope split: 子计划按主干而不是事件类型拆；每份计划都能独立落地一个可测试闭环。
- Compatibility: index 明确旧 `flow_run_events` 和 `ApplicationRunDetail` 兼容路径。
- Placeholder scan: 子计划不得留下未定内容、延后实现说明或跨任务省略说明。
