# 2026-03-12 Workflow Publish Action Separation

## 背景

`feat: split publish governance activity views` 已经把 workflow 页上的 publish 治理 UI 拆成 `panel -> binding card -> activity panel` 三层，但 `web/app/actions.ts` 仍把 workflow 工具绑定、adapter sync、publish lifecycle、published API key 全部塞在同一个 server actions 文件里。

这会带来两个问题：

- 前端职责边界已经拆开，server action 层却还在混排，后续继续补 publish 治理时容易重新耦回单文件。
- `web/app/actions.ts` 已到 444 行，虽然还没超过前端 2000 行偏好阈值，但已经成为明显的“跨业务聚合点”。

## 目标

- 让 workflow 编辑相关动作和 publish 治理动作按业务边界分离。
- 保持现有 API 行为不变，不额外引入新的前端 contract。
- 同步更新开发记录，避免 `runtime-foundation` 的体量判断继续滞后。

## 实现

本轮把前端 server actions 拆成两组：

- `web/app/actions/workflow.ts`
  - `syncAdapterTools`
  - `updateWorkflowToolBinding`
- `web/app/actions/publish.ts`
  - `updatePublishedEndpointLifecycle`
  - `createPublishedEndpointApiKey`
  - `revokePublishedEndpointApiKey`

同时保留一个极薄的 `web/app/actions.ts` barrel，作为兼容导出层，避免剩余引用点在过渡期直接断掉。

消费端同步调整为按业务模块直连：

- 插件目录 / tool binding 改为引用 `@/app/actions/workflow`
- publish lifecycle / API key 改为引用 `@/app/actions/publish`

## 影响范围

- `web/app/actions.ts`
- `web/app/actions/workflow.ts`
- `web/app/actions/publish.ts`
- `web/components/plugin-registry-panel.tsx`
- `web/components/adapter-sync-form.tsx`
- `web/components/workflow-tool-binding-panel.tsx`
- `web/components/workflow-tool-binding-form.tsx`
- `web/components/workflow-publish-binding-card.tsx`
- `web/components/workflow-publish-lifecycle-form.tsx`
- `web/components/workflow-publish-api-key-manager.tsx`

## 验证

- 执行 `pnpm exec tsc --noEmit`
- 结果：通过

## 结论

这轮改动不直接增加新功能，但它把最新一轮 publish governance UI 拆分继续落实到 action 层，避免 workflow 编辑和开放 API 治理再次在 server actions 上长回单点耦合。

## 下一步

按当前优先级，建议继续承接开放 API 治理主线：

1. 在 publish governance 区继续补 streaming / protocol surface 的可见性，而不是再起一套单独页面。
2. 若 publish 治理动作继续增长，下一轮再把 `binding card` 内的 cache / lifecycle / API key 区块继续细拆。
3. `web/components/workspace-starter-library.tsx` 与 `api/app/services/runtime.py` 仍是后续需要持续盯住的长文件。
