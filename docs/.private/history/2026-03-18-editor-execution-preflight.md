# 2026-03-18 editor execution preflight

## 本轮主题

- 继续收口 workflow editor 对强隔离 execution 的真实能力校验，避免只靠聚合 `sandbox_readiness` 误导 workflow 作者。

## 已完成

- `web/lib/workflow-tool-execution-validation.ts` 继续把 `sandboxBackends` 透传到 tool 节点与 `llm_agent` 默认执行路径，包括 `allowedToolIds`、`mockPlan.toolCalls` 与显式 execution 校验分支。
- `web/lib/workflow-tool-execution-validation-helpers.ts` 的 backend compatibility 细节已被 editor preflight 统一消费；聚合 readiness 可用但没有单个兼容 backend 时，前端会 fail-closed 并展示 backend 级原因。
- `web/lib/workflow-tool-execution-validation.test.ts` 补了一条默认强隔离工具的回归，覆盖“聚合 readiness 可用但 backend execution class 不兼容”的场景。

## 验证

- `pnpm --dir web test`
- `pnpm --dir web exec tsc --noEmit`
- `pnpm --dir web lint`

## 下一步候选

1. 把同一份 execution blocker explanation 继续扩到 run detail / publish detail，避免 editor 与运行态解释分叉。
2. 评估是否需要把 workflow workspace 维度显式传入 preflight，避免 adapter 可见性长期默认落到 `default`。
3. 继续补 sensitive access policy 与 publish draft 的 editor 连续性，而不是转去做样式整理。
