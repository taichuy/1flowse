# 2026-03-12 Publish Activity Panel Decoupling

## 背景

`web/components/workflow-publish-activity-panel.tsx` 在最近几轮 publish governance 迭代后快速增长，已经同时承担：

- 筛选表单拼装
- 治理摘要卡片与流量概览
- rate limit 窗口说明
- issue signal、API key 使用、invocation 列表渲染

这会让后续继续补 `streaming / SSE` 可视化、waiting drilldown 和长期治理面板时，重新把发布治理页面堆回单文件。

## 目标

- 先沿已有业务边界把 publish governance 面板拆开
- 保持现有数据契约和页面行为不变
- 为后续继续推进 publish P0 能力预留稳定插槽，而不是继续膨胀主组件

## 本轮实现

- 新增 `web/components/workflow-publish-activity-panel-helpers.ts`
  - 收口时间窗口、active filter chip、run status option 等稳定推导逻辑
- 新增 `web/components/workflow-publish-activity-panel-filter-form.tsx`
  - 单独承载筛选表单 UI 与参数映射
- 新增 `web/components/workflow-publish-activity-panel-sections.tsx`
  - 拆分治理摘要、timeline、issue signal、API key usage、failure reason、invocation detail 渲染区块
- 将 `web/components/workflow-publish-activity-panel.tsx` 收敛为 orchestration 壳层

## 影响范围

- `web/app/workflows/[workflowId]/page.tsx` 继续复用原组件接口，无需改调用方
- publish governance 现有功能不变，但后续可继续沿“筛选 / 概览 / 明细”三个稳定边界演进
- 这轮只做前端解耦，不改变后端 published invocation audit 契约

## 验证方式

- `pnpm exec tsc --noEmit`

## 未决问题

- publish P0 仍缺少真正的 `streaming / SSE` 发布链路与治理可视化
- `web/lib/get-workflow-publish.ts` 仍偏长，若继续补 publish 页面能力，应继续按数据域拆成更细的查询模块

## 下一步

1. 优先继续补 publish `streaming / SSE` 链路与统一事件流映射
2. 将 streaming / async 生命周期治理继续挂到拆分后的 publish activity sections，而不是回退到单文件堆叠
3. 视后续增长情况继续拆 `get-workflow-publish.ts`
