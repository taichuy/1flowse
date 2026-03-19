# 2026-03-16 Published Invocation Operator Links

## 背景

- `docs/dev/runtime-foundation.md` 在本轮优先级判断里已明确：当前主缺口不是事实链路缺失，而是 callback waiting / approval pending / notification dispatch 虽然已经被收进同一条 operator 排障主链，但 publish detail 与 execution detail 侧的直接治理入口仍偏薄。
- 最近一次提交 `88bb3d0 feat: focus blocking approvals in publish detail` 已把 published invocation detail 的阻塞审批 timeline 聚焦到 `blocking_sensitive_access_entries`，但 operator 看到 blocker 之后，仍需要逐条 timeline entry 再跳回 inbox，动作成本偏高。

## 目标

- 在不回退模型、不新增第二套状态语义的前提下，把 published invocation detail 的治理入口继续往前推一步。
- 让 operator 在 publish detail 内即可直接打开“当前 blocker 对应的 inbox slice”以及“当前 invocation 的 approval inbox slice”，减少 callback / approval 联合排障时的上下文切换。
- 顺手把 published invocation 相关的 inbox href 推导从组件壳层抽到 presenter helper，避免同类逻辑在 callback section 与 detail panel 重复分叉。

## 实现

- 在 `web/lib/published-invocation-presenters.ts` 新增 `buildPublishedInvocationInboxHref` 与 `buildBlockingPublishedInvocationInboxHref`，统一基于 waiting node run、latest approval entry、callback ticket 等上下文推导 inbox slice。
- `web/components/workflow-publish-invocation-callback-section.tsx` 改为复用共享 helper，不再在组件内重复拼接 callback waiting 的 inbox 链接。
- `web/components/workflow-publish-invocation-detail-panel.tsx` 在两处补上更直接的 operator 入口：
  - blocker 聚焦区增加 `open blocker inbox slice`
  - 全量审批 timeline 增加 `open approval inbox slice`
- 这次改动没有新增 API 字段，也没有改变 sensitive access timeline 的事实来源，仍复用现有 `run_id / node_run_id / access_request_id / approval_ticket_id` 过滤链路。

## 影响范围

- Published surface 的 callback waiting / approval 排障路径更短：operator 在 publish detail 内即可从 blocker 或 approval timeline 直接切到同范围 inbox slice。
- 同类链接推导收口到 presenter helper，降低后续 publish detail / callback section 演进时的漂移风险。
- 这一步继续服务 `P0` 的 waiting/governance 主线，也顺手缓解了 `web/components/workflow-publish-invocation-detail-panel.tsx` 的聚合压力，虽然它还没到最重热点级别。

## 验证

- `web/pnpm exec tsc --noEmit`
- `web/pnpm lint`
- `git diff --check`

## 下一步

- 继续把 publish detail / execution node card 里的 operator 动作入口做厚，例如把 pending approval、failed notification、expired callback 的常见处理动作更直接地靠近当前 blocker。
- 继续治理 `web/lib/get-workflow-publish.ts` 这类聚合型长文件，优先把 detail/list/export 的查询组装与 presenter 语义分层，避免后续 publish 细节继续堆回单文件。
