# 2026-03-16 callback ticket inbox action surface

## 背景

`WAITING_CALLBACK` 与 sensitive access governance 已经形成统一事实链，但 execution node card 与 published invocation callback section 里的 callback ticket 明细仍然停留在“只看状态和 payload”，operator 还需要先回到 summary 卡或 inbox 手动重建筛选条件，才能继续处理同一个 node run 的审批、通知或恢复动作。

这会造成两个问题：

- callback ticket 已经定位到具体 node run，但动作入口还停留在汇总层，排障链路仍有跳转成本；
- published surface 与 run diagnostics 的 callback 明细体验不一致，不利于后续继续把 waiting / approval / notification 收口成同一条 operator 主链。

## 目标

- 让 callback ticket 明细卡片本身就能直达对应的 `/sensitive-access` inbox slice`；
- 复用同一套 href 推导逻辑，避免 run diagnostics 与 published callback drilldown 各自拼接筛选参数；
- 把 ticket lifecycle 信息放到卡片预览中，减少 operator 在多个面板来回比对时间点。

## 实现

### 1. 抽出共享 callback ticket inbox link helper

新增 `web/lib/callback-ticket-links.ts`：

- 统一从 callback ticket 的 `run_id / node_run_id` 生成 inbox slice 链接；
- published invocation 场景允许补传 fallback `runId / nodeRunId`，避免 published surface 没有完整 run 上下文时丢失跳转能力；
- 仍然复用既有 `buildSensitiveAccessInboxHref`，不引入第二套 inbox query 规则。

### 2. 补 execution node card 的 ticket 动作入口

更新 `web/components/run-diagnostics-execution/execution-node-card-sections.tsx`：

- 每张 callback ticket 卡片都显示 `open inbox slice`；
- payload 预览里补上 ticket lifecycle 时间字段，方便就地判断是否已过期、已消费或已取消；
- 保持 execution node card 的 section 化边界，不把 inbox href 推导重新塞回父组件。

### 3. 补 published callback drilldown 的 ticket 动作入口

更新 `web/components/workflow-publish-invocation-callback-section.tsx`：

- 每张 published invocation callback ticket 卡片都显示 `open ticket inbox slice`；
- 优先使用 ticket 自带的 `run_id / node_run_id`，必要时回落到 invocation waiting lifecycle；
- 让 published surface 的 callback 明细和 run diagnostics 在 operator drilldown 语义上保持一致。

## 影响范围

- `web/lib/callback-ticket-links.ts`
- `web/components/run-diagnostics-execution/execution-node-card-sections.tsx`
- `web/components/workflow-publish-invocation-callback-section.tsx`
- `docs/dev/runtime-foundation.md`

## 验证

- `web/pnpm exec tsc --noEmit`
- `web/pnpm lint`

## 结果

这轮改动没有引入新的 runtime 模型或审批语义，而是把已经存在的 callback / approval / notification 主链继续压实到 operator 动作面：

- 人类 operator 在 run diagnostics 与 published invocation detail 中，都可以从 callback ticket 直接跳进同一 node run 的 inbox slice；
- waiting callback 的排障入口从“先看 summary、再人工拼筛选”收敛为“看 ticket、直接 drilldown”；
- 后续如果继续补 action suggestion、approval recovery guidance 或 presenter/helper 拆层，可以基于共享 helper 继续扩展，而不需要重新梳理链接规则。

## 下一步

1. 继续把 callback / approval / notification 的“推荐动作顺序”收敛成统一 presenter，避免入口增多后仍靠人工判断先后。
2. 继续把 published invocation detail 的其余聚合逻辑下沉到 presenter / section helper，保持详情层不重新变成热点组件。
3. 在 workflow editor 侧补结构化的 sensitive access policy 入口，推进用户层与 AI 治理层的闭环完整度。