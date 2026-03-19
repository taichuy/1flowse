# 2026-03-19 workflow-editor-sandbox-readiness-preflight-hint

## 本轮主题

- 延续 `docs/.private/runtime-foundation.md` 的 graded execution / 强隔离主线，把首页 `sandbox_readiness` 的 fail-closed 解释继续接入 workflow editor 的保存阻断链路。
- 当前工作区已经存在一组未提交的 sandbox readiness 脏改动，核心是把首页 `SandboxReadinessPanel` 的 capability / blocked class 展示抽到共享 presenter；本轮不改方向，而是补齐 editor preflight 与保存错误的统一解释消费。

## 已完成

- `web/lib/sandbox-readiness-presenters.ts`
  - 新增 `formatSandboxReadinessPreflightHint`，把 blocked execution class、offline / degraded backend 与现有 headline/detail 组合成可复用的预检提示。
- `web/lib/sandbox-readiness-presenters.test.ts`
  - 补测试覆盖：
    - 无启用 backend 时明确给出 fail-closed 提示；
    - 部分 execution class blocked 且存在 offline backend 时保留 shared hint；
    - readiness 完全健康时不额外输出预检提示。
- `web/components/workflow-editor-workbench/use-workflow-editor-validation.ts`
  - 当本地 execution capability 校验阻断保存时，把同一份 sandbox readiness 提示拼到 persist blocked message，避免首页和 editor 各说各话。
  - 当 server-side `definition drift` 含 `tool_execution` 类问题时，也复用同一份 sandbox readiness 提示。
- `web/components/workflow-editor-workbench/use-workflow-editor-persistence.ts`
  - 当保存前预检由后端返回 `tool_execution` 错误时，同样追加 shared sandbox readiness hint，而不是只显示 issue summary。
- `web/components/workflow-editor-workbench.tsx`
  - 把 `sandboxReadiness` 传入 persistence hook，接通保存链路的统一解释来源。

## 验证

- `web/pnpm exec vitest run lib/sandbox-readiness-presenters.test.ts`
- `web/pnpm exec tsc --noEmit`
- `web/pnpm lint`

## 为什么做这轮

- 这轮不是首页文案 polish，而是把 strong-isolation readiness 从“概览面板可见”推进到“作者保存前就能收到同一份 fail-closed 事实”的主链路闭环。
- 当前 `runtime-foundation` 的 P0 仍是 graded execution / 强隔离主线；相比继续局部整理首页面板，把统一解释接到 workflow editor 的阻断消息更能减少后续 drift 和误判。

## 下一步建议

1. 继续把同一份 sandbox / execution blocker explanation 接到 run detail / publish detail / operator result 的更多入口，减少页面侧自由扩写。
2. 若后端开始补更细的 execution blocker contract，可考虑把 editor 当前依赖 issue message 的路径进一步收口到结构化 presenter，而不是继续堆字符串。
3. 继续观察 `workflow-tool-execution-validation(-helpers).ts` 的热点，如果 execution constraint 继续加厚且改动传播变大，再考虑围绕 capability reasoning 做定向解耦。
